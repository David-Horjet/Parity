use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::transfer_in;
use crate::{constants::*, error::ParityError, events::PositionOpened, math, state::*};

#[derive(Accounts)]
#[instruction(side: Side)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,
    #[account(mut, seeds = [MARKET_SEED, market.symbol.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref(), &[side as u8]],
        bump
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = market.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = collateral_mint,
        token::authority = owner,
    )]
    pub owner_token: Box<Account<'info, TokenAccount>>,
    #[account(address = protocol.collateral_mint)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Opens a position, or adds margin and size to an existing one on the same side.
pub fn handle_open_position(
    ctx: Context<OpenPosition>,
    side: Side,
    margin: u64,
    size: u64,
    acceptable_price: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;

    require!(!market.paused, ParityError::MarketPaused);
    math::require_fresh_price(market, now)?;
    let price = market.price;
    match side {
        Side::Long => require!(price <= acceptable_price, ParityError::SlippageExceeded),
        Side::Short => require!(price >= acceptable_price, ParityError::SlippageExceeded),
    }
    require!(margin >= market.config.min_margin, ParityError::MarginTooSmall);

    math::accrue_funding(market, now)?;

    let is_new = position.size == 0;
    if is_new {
        position.owner = ctx.accounts.owner.key();
        position.market = market.key();
        position.side = side;
        position.bump = ctx.bumps.position;
        position.opened_at = now;
    } else {
        require!(position.side == side, ParityError::SideMismatch);
    }

    let total_margin = position.margin.checked_add(margin).ok_or(ParityError::MathOverflow)?;
    let total_size = position.size.checked_add(size).ok_or(ParityError::MathOverflow)?;
    require!(
        size >= margin
            && (total_size as u128) <= (total_margin as u128) * (market.config.max_leverage as u128),
        ParityError::InvalidLeverage
    );
    require!(
        total_size <= market.config.max_position_size,
        ParityError::PositionTooLarge
    );

    // Liquidity check uses NAV before this trade changes the book.
    let nav = math::lp_nav(market, ctx.accounts.vault.amount)?;
    let side_size = market
        .side_size(side)
        .checked_add(size)
        .ok_or(ParityError::MathOverflow)?;
    require!(
        side_size <= market.config.max_open_interest,
        ParityError::OpenInterestLimit
    );
    require!(
        side_size <= math::bps_of(nav, market.config.max_oi_to_liquidity_bps)?,
        ParityError::InsufficientLiquidity
    );

    let qty = math::qty_for(size, price)?;
    require!(qty > 0, ParityError::InvalidAmount);
    let funding_add = (size as i128)
        .checked_mul(market.funding_index)
        .ok_or(ParityError::MathOverflow)?;

    position.margin = total_margin;
    position.size = total_size;
    position.qty = position.qty.checked_add(qty).ok_or(ParityError::MathOverflow)?;
    position.funding_entry = position
        .funding_entry
        .checked_add(funding_add)
        .ok_or(ParityError::MathOverflow)?;
    position.updated_at = now;

    let (equity, _, _) = math::position_equity(position, price, market.funding_index)?;
    require!(
        equity > math::maintenance_requirement(position.size, market)? as i128,
        ParityError::WouldBeLiquidatable
    );

    match side {
        Side::Long => {
            market.long_size = side_size;
            market.long_qty = market.long_qty.checked_add(qty).ok_or(ParityError::MathOverflow)?;
            market.long_funding_entry = market
                .long_funding_entry
                .checked_add(funding_add)
                .ok_or(ParityError::MathOverflow)?;
        }
        Side::Short => {
            market.short_size = side_size;
            market.short_qty = market.short_qty.checked_add(qty).ok_or(ParityError::MathOverflow)?;
            market.short_funding_entry = market
                .short_funding_entry
                .checked_add(funding_add)
                .ok_or(ParityError::MathOverflow)?;
        }
    }
    market.total_margin = market.total_margin.checked_add(margin).ok_or(ParityError::MathOverflow)?;

    // Fee is charged on top of margin and stays in the vault for LPs.
    let fee = math::bps_of(size, market.config.trading_fee_bps)?;
    let amount = margin.checked_add(fee).ok_or(ParityError::MathOverflow)?;
    transfer_in(
        &ctx.accounts.token_program,
        &ctx.accounts.owner_token,
        &ctx.accounts.vault,
        &ctx.accounts.collateral_mint,
        &ctx.accounts.owner,
        amount,
    )?;

    emit!(PositionOpened {
        owner: position.owner,
        market: position.market,
        side,
        margin_added: margin,
        size_added: size,
        price,
        fee,
        total_margin: position.margin,
        total_size: position.size,
        timestamp: now,
    });
    Ok(())
}

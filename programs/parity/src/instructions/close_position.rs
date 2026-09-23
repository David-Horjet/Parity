use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::transfer_out;
use crate::{constants::*, error::ParityError, events::PositionClosed, math, state::*};

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,
    #[account(mut, seeds = [MARKET_SEED, market.symbol.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut,
        close = owner,
        has_one = owner @ ParityError::Unauthorized,
        has_one = market,
        seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref(), &[position.side as u8]],
        bump = position.bump
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
}

pub fn handle_close_position(ctx: Context<ClosePosition>, acceptable_price: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    let position = &ctx.accounts.position;

    // Closing stays allowed while paused so traders can always exit.
    math::require_fresh_price(market, now)?;
    let price = market.price;
    match position.side {
        Side::Long => require!(price >= acceptable_price, ParityError::SlippageExceeded),
        Side::Short => require!(price <= acceptable_price, ParityError::SlippageExceeded),
    }

    math::accrue_funding(market, now)?;
    let (equity, pnl, funding) = math::position_equity(position, price, market.funding_index)?;
    let fee = math::bps_of(position.size, market.config.trading_fee_bps)?;
    let owed = (equity - fee as i128).max(0);
    let payout = math::to_u64(owed as u128)?.min(ctx.accounts.vault.amount);

    remove_from_book(market, position)?;

    transfer_out(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.owner_token,
        &ctx.accounts.collateral_mint,
        market,
        payout,
    )?;

    emit!(PositionClosed {
        owner: position.owner,
        market: position.market,
        side: position.side,
        margin: position.margin,
        size: position.size,
        entry_price: math::entry_price(position.size, position.qty)?,
        exit_price: price,
        pnl: math::to_i64(pnl)?,
        funding: math::to_i64(funding)?,
        fee,
        payout,
        timestamp: now,
    });
    Ok(())
}

pub fn remove_from_book(market: &mut Market, position: &Position) -> Result<()> {
    match position.side {
        Side::Long => {
            market.long_size = market.long_size.checked_sub(position.size).ok_or(ParityError::MathOverflow)?;
            market.long_qty = market.long_qty.checked_sub(position.qty).ok_or(ParityError::MathOverflow)?;
            market.long_funding_entry = market
                .long_funding_entry
                .checked_sub(position.funding_entry)
                .ok_or(ParityError::MathOverflow)?;
        }
        Side::Short => {
            market.short_size = market.short_size.checked_sub(position.size).ok_or(ParityError::MathOverflow)?;
            market.short_qty = market.short_qty.checked_sub(position.qty).ok_or(ParityError::MathOverflow)?;
            market.short_funding_entry = market
                .short_funding_entry
                .checked_sub(position.funding_entry)
                .ok_or(ParityError::MathOverflow)?;
        }
    }
    market.total_margin = market
        .total_margin
        .checked_sub(position.margin)
        .ok_or(ParityError::MathOverflow)?;
    Ok(())
}

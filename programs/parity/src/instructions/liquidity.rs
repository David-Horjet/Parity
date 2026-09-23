use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::{transfer_in, transfer_out};
use crate::{constants::*, error::ParityError, events::LiquidityChanged, math, state::*};

#[derive(Accounts)]
pub struct DepositLiquidity<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,
    #[account(mut, seeds = [MARKET_SEED, market.symbol.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + LpPosition::INIT_SPACE,
        seeds = [LP_SEED, market.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub lp_position: Box<Account<'info, LpPosition>>,
    #[account(mut, address = market.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: Box<Account<'info, TokenAccount>>,
    #[account(address = protocol.collateral_mint)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// NAV depends on the mark, so require a fresh price whenever traders hold positions.
fn require_nav_price(market: &Market, now: i64) -> Result<()> {
    if market.long_size > 0 || market.short_size > 0 {
        math::require_fresh_price(market, now)?;
    }
    Ok(())
}

pub fn handle_deposit_liquidity(ctx: Context<DepositLiquidity>, amount: u64) -> Result<()> {
    require!(amount > 0, ParityError::InvalidAmount);
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    require!(!market.paused, ParityError::MarketPaused);
    require_nav_price(market, now)?;
    math::accrue_funding(market, now)?;

    let nav = math::lp_nav(market, ctx.accounts.vault.amount)?;
    let shares = if market.lp_shares == 0 || nav == 0 {
        amount
    } else {
        math::to_u64((amount as u128) * (market.lp_shares as u128) / (nav as u128))?
    };
    require!(shares > 0, ParityError::InvalidAmount);

    let lp = &mut ctx.accounts.lp_position;
    if lp.shares == 0 {
        lp.owner = ctx.accounts.owner.key();
        lp.market = market.key();
        lp.bump = ctx.bumps.lp_position;
    }
    lp.shares = lp.shares.checked_add(shares).ok_or(ParityError::MathOverflow)?;
    market.lp_shares = market.lp_shares.checked_add(shares).ok_or(ParityError::MathOverflow)?;

    transfer_in(
        &ctx.accounts.token_program,
        &ctx.accounts.owner_token,
        &ctx.accounts.vault,
        &ctx.accounts.collateral_mint,
        &ctx.accounts.owner,
        amount,
    )?;

    emit!(LiquidityChanged {
        owner: lp.owner,
        market: lp.market,
        amount,
        shares,
        deposit: true,
        timestamp: now,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawLiquidity<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,
    #[account(mut, seeds = [MARKET_SEED, market.symbol.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut,
        has_one = owner @ ParityError::Unauthorized,
        has_one = market,
        seeds = [LP_SEED, market.key().as_ref(), owner.key().as_ref()],
        bump = lp_position.bump
    )]
    pub lp_position: Box<Account<'info, LpPosition>>,
    #[account(mut, address = market.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: Box<Account<'info, TokenAccount>>,
    #[account(address = protocol.collateral_mint)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw_liquidity(ctx: Context<WithdrawLiquidity>, shares: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    let lp = &mut ctx.accounts.lp_position;
    require!(shares > 0 && shares <= lp.shares, ParityError::InvalidAmount);
    require_nav_price(market, now)?;
    math::accrue_funding(market, now)?;

    let nav = math::lp_nav(market, ctx.accounts.vault.amount)?;
    let amount = math::to_u64((shares as u128) * (nav as u128) / (market.lp_shares as u128))?;

    // Remaining liquidity must still back current open interest.
    let remaining = nav.checked_sub(amount).ok_or(ParityError::MathOverflow)?;
    let cap = math::bps_of(remaining, market.config.max_oi_to_liquidity_bps)?;
    require!(
        market.long_size <= cap && market.short_size <= cap,
        ParityError::InsufficientLiquidity
    );

    lp.shares -= shares;
    market.lp_shares -= shares;

    transfer_out(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.owner_token,
        &ctx.accounts.collateral_mint,
        market,
        amount,
    )?;

    emit!(LiquidityChanged {
        owner: lp.owner,
        market: lp.market,
        amount,
        shares,
        deposit: false,
        timestamp: now,
    });
    Ok(())
}

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use super::{remove_from_book, transfer_out};
use crate::{constants::*, error::ParityError, events::PositionLiquidated, math, state::*};

#[derive(Accounts)]
pub struct Liquidate<'info> {
    pub liquidator: Signer<'info>,
    /// CHECK: receives the position's rent; checked against position.owner.
    #[account(mut, address = position.owner)]
    pub owner: UncheckedAccount<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump)]
    pub protocol: Account<'info, Protocol>,
    #[account(mut, seeds = [MARKET_SEED, market.symbol.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut,
        close = owner,
        has_one = market,
        seeds = [POSITION_SEED, market.key().as_ref(), position.owner.as_ref(), &[position.side as u8]],
        bump = position.bump
    )]
    pub position: Box<Account<'info, Position>>,
    #[account(mut, address = market.vault)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = collateral_mint)]
    pub liquidator_token: Box<Account<'info, TokenAccount>>,
    #[account(address = protocol.collateral_mint)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

/// Permissionless. Liquidator earns a fee; remaining equity stays with LPs.
pub fn handle_liquidate(ctx: Context<Liquidate>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    let position = &ctx.accounts.position;

    math::require_fresh_price(market, now)?;
    let price = market.price;
    math::accrue_funding(market, now)?;

    let (equity, pnl, funding) = math::position_equity(position, price, market.funding_index)?;
    let requirement = math::maintenance_requirement(position.size, market)?;
    require!(equity < requirement as i128, ParityError::NotLiquidatable);

    let reward_cap = math::bps_of(position.size, market.config.liquidation_fee_bps)?;
    let reward = math::to_u64(equity.max(0) as u128)?
        .min(reward_cap)
        .min(ctx.accounts.vault.amount);

    remove_from_book(market, position)?;

    transfer_out(
        &ctx.accounts.token_program,
        &ctx.accounts.vault,
        &ctx.accounts.liquidator_token,
        &ctx.accounts.collateral_mint,
        market,
        reward,
    )?;

    emit!(PositionLiquidated {
        owner: position.owner,
        market: position.market,
        liquidator: ctx.accounts.liquidator.key(),
        side: position.side,
        margin: position.margin,
        size: position.size,
        entry_price: math::entry_price(position.size, position.qty)?,
        exit_price: price,
        pnl: math::to_i64(pnl)?,
        funding: math::to_i64(funding)?,
        liquidator_reward: reward,
        timestamp: now,
    });
    Ok(())
}

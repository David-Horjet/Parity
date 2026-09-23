use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::ParityError, math::validate_symbol, state::*};

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Protocol::INIT_SPACE,
        seeds = [PROTOCOL_SEED],
        bump
    )]
    pub protocol: Account<'info, Protocol>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_protocol(ctx: Context<InitializeProtocol>, keeper: Pubkey) -> Result<()> {
    let protocol = &mut ctx.accounts.protocol;
    protocol.admin = ctx.accounts.admin.key();
    protocol.keeper = keeper;
    protocol.collateral_mint = ctx.accounts.collateral_mint.key();
    protocol.market_count = 0;
    protocol.bump = ctx.bumps.protocol;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateProtocol<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = admin @ ParityError::Unauthorized)]
    pub protocol: Account<'info, Protocol>,
}

pub fn handle_update_protocol(ctx: Context<UpdateProtocol>, new_admin: Pubkey, keeper: Pubkey) -> Result<()> {
    let protocol = &mut ctx.accounts.protocol;
    protocol.admin = new_admin;
    protocol.keeper = keeper;
    Ok(())
}

#[derive(Accounts)]
#[instruction(symbol: [u8; SYMBOL_LEN])]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = admin @ ParityError::Unauthorized)]
    pub protocol: Account<'info, Protocol>,
    #[account(
        init,
        payer = admin,
        space = 8 + Market::INIT_SPACE,
        seeds = [MARKET_SEED, symbol.as_ref()],
        bump
    )]
    pub market: Box<Account<'info, Market>>,
    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = market,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(address = protocol.collateral_mint)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_market(
    ctx: Context<CreateMarket>,
    symbol: [u8; SYMBOL_LEN],
    asset_mint: Pubkey,
    config: MarketConfig,
) -> Result<()> {
    config.validate()?;
    validate_symbol(&symbol)?;
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    market.symbol = symbol;
    market.asset_mint = asset_mint;
    market.vault = ctx.accounts.vault.key();
    market.config = config;
    market.paused = false;
    market.funding_updated_at = now;
    market.bump = ctx.bumps.market;
    market.vault_bump = ctx.bumps.vault;
    ctx.accounts.protocol.market_count = ctx
        .accounts
        .protocol
        .market_count
        .checked_add(1)
        .ok_or(ParityError::MathOverflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct AdminMarket<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = admin @ ParityError::Unauthorized)]
    pub protocol: Account<'info, Protocol>,
    #[account(mut, seeds = [MARKET_SEED, market.symbol.as_ref()], bump = market.bump)]
    pub market: Box<Account<'info, Market>>,
}

pub fn handle_update_market_config(ctx: Context<AdminMarket>, config: MarketConfig) -> Result<()> {
    config.validate()?;
    let market = &mut ctx.accounts.market;
    // Settle funding at the old rate before changing it.
    crate::math::accrue_funding(market, Clock::get()?.unix_timestamp)?;
    market.config = config;
    Ok(())
}

pub fn handle_set_market_paused(ctx: Context<AdminMarket>, paused: bool) -> Result<()> {
    ctx.accounts.market.paused = paused;
    Ok(())
}

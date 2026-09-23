use anchor_lang::prelude::*;

use crate::{constants::*, error::ParityError};

#[account]
#[derive(InitSpace)]
pub struct Protocol {
    pub admin: Pubkey,
    /// Authorized price publisher.
    pub keeper: Pubkey,
    pub collateral_mint: Pubkey,
    pub market_count: u16,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Side {
    Long,
    Short,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, InitSpace)]
pub struct MarketConfig {
    pub max_leverage: u8,
    pub maintenance_margin_bps: u16,
    pub trading_fee_bps: u16,
    /// Paid to the liquidator, as a share of position size.
    pub liquidation_fee_bps: u16,
    pub min_margin: u64,
    pub max_position_size: u64,
    /// Per side, in USDC.
    pub max_open_interest: u64,
    /// Per side open interest cap as a share of LP liquidity.
    pub max_oi_to_liquidity_bps: u16,
    pub max_price_age_secs: u32,
    /// Max change per price update; larger moves are clamped.
    pub max_price_move_bps: u16,
    /// Funding rate at 100% skew.
    pub max_funding_rate_bps_per_hour: u16,
}

impl MarketConfig {
    pub fn validate(&self) -> Result<()> {
        let c = self;
        require!(
            c.max_leverage >= 1 && c.max_leverage <= LEVERAGE_HARD_CAP,
            ParityError::InvalidConfig
        );
        // Maintenance must sit below initial margin at max leverage.
        require!(
            c.maintenance_margin_bps > 0
                && (c.maintenance_margin_bps as u64) * (c.max_leverage as u64) < BPS,
            ParityError::InvalidConfig
        );
        require!(c.trading_fee_bps <= 100, ParityError::InvalidConfig);
        require!(
            c.liquidation_fee_bps < c.maintenance_margin_bps,
            ParityError::InvalidConfig
        );
        require!(c.min_margin > 0, ParityError::InvalidConfig);
        require!(
            c.max_position_size > 0 && c.max_open_interest > 0,
            ParityError::InvalidConfig
        );
        require!(
            c.max_oi_to_liquidity_bps > 0 && (c.max_oi_to_liquidity_bps as u64) <= BPS,
            ParityError::InvalidConfig
        );
        require!(c.max_price_age_secs > 0, ParityError::InvalidConfig);
        require!(
            c.max_price_move_bps > 0 && (c.max_price_move_bps as u64) < BPS,
            ParityError::InvalidConfig
        );
        require!(
            c.max_funding_rate_bps_per_hour <= 100,
            ParityError::InvalidConfig
        );
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub symbol: [u8; SYMBOL_LEN],
    /// PreStocks token mint this market tracks (mainnet address).
    pub asset_mint: Pubkey,
    pub vault: Pubkey,
    pub config: MarketConfig,
    pub paused: bool,

    pub price: u64,
    pub price_updated_at: i64,

    /// Entry notional and quantity summed over open positions.
    pub long_size: u64,
    pub long_qty: u64,
    pub short_size: u64,
    pub short_qty: u64,
    /// Sum of size * funding index at entry, per side.
    pub long_funding_entry: i128,
    pub short_funding_entry: i128,
    /// Trader margin held in the vault.
    pub total_margin: u64,

    pub funding_index: i128,
    pub funding_updated_at: i64,

    pub lp_shares: u64,

    pub bump: u8,
    pub vault_bump: u8,
}

impl Market {
    pub fn side_size(&self, side: Side) -> u64 {
        match side {
            Side::Long => self.long_size,
            Side::Short => self.short_size,
        }
    }
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub margin: u64,
    /// Entry notional in USDC.
    pub size: u64,
    pub qty: u64,
    /// Sum of size * funding index at entry.
    pub funding_entry: i128,
    pub opened_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpPosition {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub shares: u64,
    pub bump: u8,
}

use anchor_lang::prelude::*;

use crate::state::Side;

#[event]
pub struct PositionOpened {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub margin_added: u64,
    pub size_added: u64,
    pub price: u64,
    pub fee: u64,
    pub total_margin: u64,
    pub total_size: u64,
    pub timestamp: i64,
}

#[event]
pub struct PositionClosed {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub margin: u64,
    pub size: u64,
    pub entry_price: u64,
    pub exit_price: u64,
    pub pnl: i64,
    pub funding: i64,
    pub fee: u64,
    pub payout: u64,
    pub timestamp: i64,
}

#[event]
pub struct PositionLiquidated {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub liquidator: Pubkey,
    pub side: Side,
    pub margin: u64,
    pub size: u64,
    pub entry_price: u64,
    pub exit_price: u64,
    pub pnl: i64,
    pub funding: i64,
    pub liquidator_reward: u64,
    pub timestamp: i64,
}

#[event]
pub struct LiquidityChanged {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub shares: u64,
    pub deposit: bool,
    pub timestamp: i64,
}

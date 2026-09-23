pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3drNH9yAW1yum78fo2ire96LXLcqzHUFzdkwDpdK3Zrh");

#[program]
pub mod parity {
    use super::*;

    pub fn initialize_protocol(ctx: Context<InitializeProtocol>, keeper: Pubkey) -> Result<()> {
        instructions::handle_initialize_protocol(ctx, keeper)
    }

    pub fn update_protocol(ctx: Context<UpdateProtocol>, new_admin: Pubkey, keeper: Pubkey) -> Result<()> {
        instructions::handle_update_protocol(ctx, new_admin, keeper)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        symbol: [u8; SYMBOL_LEN],
        asset_mint: Pubkey,
        config: MarketConfig,
    ) -> Result<()> {
        instructions::handle_create_market(ctx, symbol, asset_mint, config)
    }

    pub fn update_market_config(ctx: Context<AdminMarket>, config: MarketConfig) -> Result<()> {
        instructions::handle_update_market_config(ctx, config)
    }

    pub fn set_market_paused(ctx: Context<AdminMarket>, paused: bool) -> Result<()> {
        instructions::handle_set_market_paused(ctx, paused)
    }

    pub fn update_price(ctx: Context<UpdatePrice>, price: u64) -> Result<()> {
        instructions::handle_update_price(ctx, price)
    }

    pub fn open_position(
        ctx: Context<OpenPosition>,
        side: Side,
        margin: u64,
        size: u64,
        acceptable_price: u64,
    ) -> Result<()> {
        instructions::handle_open_position(ctx, side, margin, size, acceptable_price)
    }

    pub fn close_position(ctx: Context<ClosePosition>, acceptable_price: u64) -> Result<()> {
        instructions::handle_close_position(ctx, acceptable_price)
    }

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        instructions::handle_liquidate(ctx)
    }

    pub fn deposit_liquidity(ctx: Context<DepositLiquidity>, amount: u64) -> Result<()> {
        instructions::handle_deposit_liquidity(ctx, amount)
    }

    pub fn withdraw_liquidity(ctx: Context<WithdrawLiquidity>, shares: u64) -> Result<()> {
        instructions::handle_withdraw_liquidity(ctx, shares)
    }
}

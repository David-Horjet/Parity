use anchor_lang::prelude::*;

use crate::{constants::*, error::ParityError, math, state::*};

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    pub keeper: Signer<'info>,
    #[account(seeds = [PROTOCOL_SEED], bump = protocol.bump, has_one = keeper @ ParityError::Unauthorized)]
    pub protocol: Account<'info, Protocol>,
    #[account(mut, seeds = [MARKET_SEED, market.symbol.as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
}

pub fn handle_update_price(ctx: Context<UpdatePrice>, price: u64) -> Result<()> {
    require!(price > 0, ParityError::InvalidPrice);
    let now = Clock::get()?.unix_timestamp;
    let market = &mut ctx.accounts.market;
    math::accrue_funding(market, now)?;

    let old = market.price;
    market.price = if old == 0 {
        price
    } else {
        // Clamp so one bad sample can't jump the index; it catches up over updates.
        let band = math::bps_of(old, market.config.max_price_move_bps)?;
        price.clamp(old.saturating_sub(band).max(1), old.saturating_add(band))
    };
    market.price_updated_at = now;
    Ok(())
}

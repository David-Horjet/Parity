use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::ParityError,
    state::{Market, Position, Side},
};

pub fn to_u64(v: u128) -> Result<u64> {
    u64::try_from(v).map_err(|_| error!(ParityError::MathOverflow))
}

pub fn to_i64(v: i128) -> Result<i64> {
    i64::try_from(v).map_err(|_| error!(ParityError::MathOverflow))
}

pub fn bps_of(amount: u64, bps: u16) -> Result<u64> {
    to_u64((amount as u128) * (bps as u128) / (BPS as u128))
}

/// Asset quantity bought with `size` USDC at `price`.
pub fn qty_for(size: u64, price: u64) -> Result<u64> {
    require!(price > 0, ParityError::InvalidPrice);
    to_u64((size as u128) * QTY_SCALE / (price as u128))
}

/// USDC value of `qty` at `price`.
pub fn value_of(qty: u64, price: u64) -> Result<u64> {
    to_u64((qty as u128) * (price as u128) / QTY_SCALE)
}

pub fn entry_price(size: u64, qty: u64) -> Result<u64> {
    require!(qty > 0, ParityError::InvalidAmount);
    to_u64((size as u128) * QTY_SCALE / (qty as u128))
}

/// Unrealized PnL of `qty` opened for `size` USDC.
pub fn pnl(side: Side, size: u64, qty: u64, price: u64) -> Result<i128> {
    let value = value_of(qty, price)? as i128;
    Ok(match side {
        Side::Long => value - size as i128,
        Side::Short => size as i128 - value,
    })
}

/// Funding owed by a holder (negative = receives). Longs pay a rising index.
pub fn funding_owed(side: Side, size: u64, funding_entry: i128, index: i128) -> Result<i128> {
    let accrued = (size as i128)
        .checked_mul(index)
        .and_then(|v| v.checked_sub(funding_entry))
        .ok_or(ParityError::MathOverflow)?
        / FUNDING_SCALE;
    Ok(match side {
        Side::Long => accrued,
        Side::Short => -accrued,
    })
}

pub fn position_equity(pos: &Position, price: u64, index: i128) -> Result<(i128, i128, i128)> {
    let pnl = pnl(pos.side, pos.size, pos.qty, price)?;
    let funding = funding_owed(pos.side, pos.size, pos.funding_entry, index)?;
    let equity = pos.margin as i128 + pnl - funding;
    Ok((equity, pnl, funding))
}

pub fn maintenance_requirement(size: u64, market: &Market) -> Result<u64> {
    bps_of(size, market.config.maintenance_margin_bps)
}

/// Accrue funding since the last update, based on open interest skew.
pub fn accrue_funding(market: &mut Market, now: i64) -> Result<()> {
    let dt = now.saturating_sub(market.funding_updated_at);
    if dt <= 0 {
        return Ok(());
    }
    let long = market.long_size as i128;
    let short = market.short_size as i128;
    let total = long + short;
    if total > 0 && market.config.max_funding_rate_bps_per_hour > 0 {
        let delta = FUNDING_SCALE
            .checked_mul(market.config.max_funding_rate_bps_per_hour as i128)
            .and_then(|v| v.checked_mul(long - short))
            .and_then(|v| v.checked_mul(dt as i128))
            .ok_or(ParityError::MathOverflow)?
            / (total * BPS as i128 * SECONDS_PER_HOUR);
        market.funding_index = market
            .funding_index
            .checked_add(delta)
            .ok_or(ParityError::MathOverflow)?;
    }
    market.funding_updated_at = now;
    Ok(())
}

/// Aggregate trader claim on the vault: margin + PnL - funding owed.
pub fn trader_claims(market: &Market) -> Result<i128> {
    let long_pnl = pnl(Side::Long, market.long_size, market.long_qty, market.price)?;
    let short_pnl = pnl(Side::Short, market.short_size, market.short_qty, market.price)?;
    let long_funding = funding_owed(
        Side::Long,
        market.long_size,
        market.long_funding_entry,
        market.funding_index,
    )?;
    let short_funding = funding_owed(
        Side::Short,
        market.short_size,
        market.short_funding_entry,
        market.funding_index,
    )?;
    Ok(market.total_margin as i128 + long_pnl + short_pnl - long_funding - short_funding)
}

/// LP net asset value: vault balance minus what traders are owed.
pub fn lp_nav(market: &Market, vault_balance: u64) -> Result<u64> {
    let nav = vault_balance as i128 - trader_claims(market)?;
    Ok(if nav <= 0 { 0 } else { to_u64(nav as u128)? })
}

pub fn require_fresh_price(market: &Market, now: i64) -> Result<()> {
    require!(market.price > 0, ParityError::InvalidPrice);
    require!(
        now.saturating_sub(market.price_updated_at) <= market.config.max_price_age_secs as i64,
        ParityError::StalePrice
    );
    Ok(())
}

/// Uppercase ASCII letters/digits, right-padded with zeros.
pub fn validate_symbol(symbol: &[u8; SYMBOL_LEN]) -> Result<()> {
    let len = symbol.iter().position(|b| *b == 0).unwrap_or(SYMBOL_LEN);
    require!(
        len > 0
            && symbol[..len].iter().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
            && symbol[len..].iter().all(|b| *b == 0),
        ParityError::InvalidSymbol
    );
    Ok(())
}

pub fn symbol_bytes(symbol: &str) -> Result<[u8; SYMBOL_LEN]> {
    let raw = symbol.as_bytes();
    require!(
        !raw.is_empty()
            && raw.len() <= SYMBOL_LEN
            && raw.iter().all(|b| b.is_ascii_uppercase() || b.is_ascii_digit()),
        ParityError::InvalidSymbol
    );
    let mut out = [0u8; SYMBOL_LEN];
    out[..raw.len()].copy_from_slice(raw);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn long_and_short_pnl() {
        let price = 100 * PRICE_SCALE;
        let size = 500 * PRICE_SCALE;
        let qty = qty_for(size, price).unwrap();
        assert_eq!(qty, 5 * QTY_SCALE as u64);
        let up = 110 * PRICE_SCALE;
        assert_eq!(pnl(Side::Long, size, qty, up).unwrap(), 50 * PRICE_SCALE as i128);
        assert_eq!(pnl(Side::Short, size, qty, up).unwrap(), -50 * PRICE_SCALE as i128);
        assert_eq!(entry_price(size, qty).unwrap(), price);
    }

    #[test]
    fn funding_signs() {
        // Index rose by 0.01 per unit notional: longs pay, shorts receive.
        let idx = FUNDING_SCALE / 100;
        let size = 1_000 * PRICE_SCALE;
        assert_eq!(funding_owed(Side::Long, size, 0, idx).unwrap(), 10 * PRICE_SCALE as i128);
        assert_eq!(funding_owed(Side::Short, size, 0, idx).unwrap(), -10 * PRICE_SCALE as i128);
    }

    #[test]
    fn symbols() {
        assert!(symbol_bytes("OPENAI").is_ok());
        assert!(symbol_bytes("openai").is_err());
        assert!(symbol_bytes("").is_err());
        assert!(symbol_bytes("ABCDEFGHIJKLMNOPQ").is_err());
        let mut gap = symbol_bytes("AB").unwrap();
        gap[3] = b'C';
        assert!(validate_symbol(&gap).is_err());
        assert!(validate_symbol(&[0u8; SYMBOL_LEN]).is_err());
    }
}

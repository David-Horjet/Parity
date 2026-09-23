/// Prices are USD with 6 decimals (same as USDC).
pub const PRICE_SCALE: u64 = 1_000_000;
/// Position quantity is in asset tokens with 9 decimals.
pub const QTY_SCALE: u128 = 1_000_000_000;
/// Funding index precision, per 1 unit of notional.
pub const FUNDING_SCALE: i128 = 1_000_000_000_000;
pub const BPS: u64 = 10_000;
pub const SECONDS_PER_HOUR: i128 = 3_600;

pub const SYMBOL_LEN: usize = 16;
pub const LEVERAGE_HARD_CAP: u8 = 20;

pub const PROTOCOL_SEED: &[u8] = b"protocol";
pub const MARKET_SEED: &[u8] = b"market";
pub const VAULT_SEED: &[u8] = b"vault";
pub const POSITION_SEED: &[u8] = b"position";
pub const LP_SEED: &[u8] = b"lp";

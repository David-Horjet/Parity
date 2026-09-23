use anchor_lang::prelude::*;

#[error_code]
pub enum ParityError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid market config")]
    InvalidConfig,
    #[msg("Invalid symbol")]
    InvalidSymbol,
    #[msg("Market is paused")]
    MarketPaused,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Price is stale")]
    StalePrice,
    #[msg("Margin below minimum")]
    MarginTooSmall,
    #[msg("Leverage out of range")]
    InvalidLeverage,
    #[msg("Position size above limit")]
    PositionTooLarge,
    #[msg("Open interest limit reached")]
    OpenInterestLimit,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Price moved beyond acceptable price")]
    SlippageExceeded,
    #[msg("Position is not liquidatable")]
    NotLiquidatable,
    #[msg("Position would be liquidatable")]
    WouldBeLiquidatable,
    #[msg("Side mismatch")]
    SideMismatch,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Math overflow")]
    MathOverflow,
}

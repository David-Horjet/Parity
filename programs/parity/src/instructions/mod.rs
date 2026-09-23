pub mod admin;
pub mod close_position;
pub mod liquidate;
pub mod liquidity;
pub mod open_position;
pub mod update_price;

pub use admin::*;
pub use close_position::*;
pub use liquidate::*;
pub use liquidity::*;
pub use open_position::*;
pub use update_price::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::{constants::MARKET_SEED, state::Market};

pub fn transfer_in<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    token::transfer_checked(
        CpiContext::new(
            token_program.key(),
            TransferChecked {
                from: from.to_account_info(),
                to: to.to_account_info(),
                mint: mint.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        amount,
        mint.decimals,
    )
}

pub fn transfer_out<'info>(
    token_program: &Program<'info, Token>,
    vault: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    market: &Account<'info, Market>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let seeds: &[&[u8]] = &[MARKET_SEED, market.symbol.as_ref(), &[market.bump]];
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: vault.to_account_info(),
                to: to.to_account_info(),
                mint: mint.to_account_info(),
                authority: market.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        mint.decimals,
    )
}

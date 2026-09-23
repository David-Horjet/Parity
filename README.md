# Parity

**Trade private companies with leverage, 24/7, on Solana.**

Parity is a perpetual futures market for [PreStocks](https://prestocks.com) tokenized pre-IPO companies. Deposit USDC, pick OpenAI, Anthropic, Anduril, Neuralink, Figure AI, Kalshi or Polymarket, and go **long or short with 1–5x leverage**.

PreStocks gives you exposure to private companies. Parity is the derivatives layer on top: the first way to **short** a pre-IPO company, and a way to size conviction with leverage, without borrowing the token.

Built for [Stocklana](https://hackathons.solana.com/hackathons/stocklana) · PreStocks bounty.

## Try it (devnet)

1. Open the app and connect a Solana wallet (Phantom, Solflare, Backpack) or sign in with email.
2. Hit **Faucet**: you get 10,000 test USDC plus a little devnet SOL for fees.
3. Pick a company, enter margin, choose leverage, **Long** or **Short**. The liquidation price and fee are shown before you sign.
4. Watch PnL move with the market, then **Close**. History shows entry, exit, PnL and fees.
5. **Earn**: deposit USDC into a market vault to be the counterparty and earn fees and funding.

## How it works

```
PreStocks API ──┐                          ┌── Next.js app (Privy wallet)
Jupiter Price ──┼─► Keeper ── update_price ─► Parity program ◄── open / close
                │   (TWAP + guards)        │   (Anchor, devnet)
                └─► Supabase ◄── events ───┘   per-market USDC vault
                    (history, charts)
```

**Pricing.** Positions are marked to a **5-minute TWAP of each PreStocks token's Jupiter spot price**, the price traders actually see and can hedge against. Every sample is guarded:
- rejected if its premium to the PreStocks SPV mark is extreme
- rejected if pool liquidity is thin
- the program clamps each update to a max move and refuses stale prices

PreStocks' SPV mark and implied valuation are shown alongside.

**Risk.** Isolated margin, 1–5x leverage, 5% maintenance margin, per-side open-interest caps (absolute and as a share of vault liquidity), max position size, and **permissionless liquidation**. The keeper liquidates automatically, but anyone can call it.

**Funding.** A bounded, skew-based rate: when longs outweigh shorts, longs pay, and vice versa. It accrues continuously via a cumulative index.

**Liquidity.** Each market has a USDC vault that is the counterparty to traders. LPs earn trading fees, funding and trader losses, and pay trader profits. LP shares are priced from vault balance minus what traders are owed, computed on-chain.

**Why Solana.** Sub-second, sub-cent transactions make 24/7 leveraged trading on a thin, fast-moving asset class practical. PreStocks tokens already live on Solana, so the oracle reads the same markets traders use.

## Repo

| Path | What |
|------|------|
| `programs/parity` | Anchor program: markets, price feed, open/close, liquidation, funding, LP vault. LiteSVM tests. |
| `packages/prestocks` | PreStocks + Jupiter adapter: validation, market discovery, guarded TWAP |
| `packages/sdk` | TypeScript client: PDAs, instructions, decoding, events, math mirrored from Rust |
| `keeper` | Price publisher, liquidator, event indexer; devnet bootstrap, backfill and e2e scripts |
| `app` | Next.js trading app and API routes |
| `supabase/migrations` | Read models for history and charts. On-chain state is the source of truth. |

Program (devnet): `3drNH9yAW1yum78fo2ire96LXLcqzHUFzdkwDpdK3Zrh`

## Run locally

```bash
pnpm install
cp .env.example .env          # fill Privy, Supabase, RPC
cargo test -p parity          # program tests (after `anchor build`)
pnpm test                     # adapter + SDK tests
pnpm --filter @parity/keeper bootstrap   # one-time devnet setup
pnpm keeper                   # prices, liquidations, indexing
pnpm dev                      # app on :3000
pnpm --filter @parity/keeper e2e         # end-to-end check against the running app
```

## Only PreStocks assets

Markets are discovered from `prestocks.com/api/prestocks`. No other pre-IPO issuer is integrated. SPACEX is excluded because the token is in its post-IPO conversion window.

## Open source used

Anchor, LiteSVM, @solana/web3.js, Privy, Next.js, Tailwind, Framer Motion, Hugeicons, TradingView Lightweight Charts, Supabase. Candle history comes from GeckoTerminal; spot prices come from Jupiter Price API v3.

Devnet only, unaudited. Not investment advice.

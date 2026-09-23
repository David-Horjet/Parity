# Parity — Build Tracker

Stocklana hackathon · PreStocks bounty · Submissions close **Fri 25 Sep 2026, 4:00pm ET**

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` dropped

---

## Decisions

| # | Decision | Why |
|---|----------|-----|
| D1 | Oracle-priced synthetic perps, isolated margin, vault as counterparty | Fastest safe model; no AMM/order book needed |
| D2 | Devnet deploy with a mock USDC mint + faucet | Judges can test without real money; unaudited vault stays off mainnet |
| D3 | Real PreStocks API data drives the devnet oracle | Bounty requires real PreStocks markets |
| D4 | No separate backend service — Next.js route handlers + Supabase | Cuts one deployable; same read APIs |
| D5 | Keeper does both jobs: publish prices onchain + index events into Supabase | One Node process to run and monitor |
| D6 | Market denylist config (SPACEX excluded) | API still returns SPACEX; nothing in the payload marks it as converting |
| D7 | Oracle = Jupiter Price API v3 `usdPrice` (spot), keeper-computed 5-min TWAP, guarded by PreStocks mark price | Spot is what traders see and hedge against; mark alone barely moves |
| D8 | Keep the name "Parity" | User decision |
| D9 | No demo price-shock tool; liquidations only happen from real price moves (keeper-run) and are covered in tests | Should feel like a normal crypto perp |
| D10 | Rejected: Pyth `OPENAI/USD`, `ANTHROPIC/USD` | Only 2 of 7 markets, Lazer-only (paid key), not PreStocks-sourced |

## Oracle design (D7)

- **Source:** `GET lite-api.jup.ag/price/v3?ids=<mints>`. One call covers all markets: `usdPrice` (spot), `liquidity`, `stockData.price` (= PreStocks mark)
- **Cross-check:** `prestocks.com/api/prestocks` `markPrice` (its `tokenPrice` is Jupiter's `usdPrice`, verified exact match)
- **Keeper:** sample every ~10s → 5-min TWAP → publish onchain
- **Guards:** reject if spot deviates from mark beyond a per-market band; cap max move per update; reject if pool liquidity < floor; program rejects stale prices
- **Why TWAP + OI caps:** pools hold only $100k–$250k of liquidity, so raw spot is cheap to push around
- **Scaled UI tokens:** respect `scaledUiConfig` multiplier (SPACEX has one; excluded anyway)
- **Fallback:** if Jupiter is down, freeze opens and keep the last valid price for closes until it goes stale

## Open questions

- none

## Environment

- [x] `.env` comments switched to `#` (backup in `.keys/env.backup`)
- [x] Privy app id exposed to client via `next.config.ts` (maps `PRIVY_API_ID`)
- [x] Added RPC, program, USDC mint, keypair vars; `.env.example` committed
- [ ] **Dedicated devnet RPC** (Helius etc.): public RPC 429s the keeper
- [ ] Privy dashboard: Solana enabled, allowed origins = localhost:3000 + prod domain

---

## Phase 0 — Recon & setup

- [x] Inspect PreStocks API schema (`/api/prestocks`, 8 assets, no auth, `max-age=0`)
- [x] Oracle source chosen (D7): mark moves in small steps every few minutes; Jupiter spot moves ±2–4%/24h
- [x] Monorepo: `app/`, `programs/parity`, `keeper/`, `packages/prestocks`, `packages/sdk`
- [x] Anchor 1.0 / Solana 3.1 toolchain; devnet deployer `.keys/deployer.json` funded

## Phase 1 — PreStocks adapter (P0)

- [x] `client.ts` PreStocks + Jupiter Price v3 fetch, timeout, retry
- [x] `validation.ts` zod schema, positive finite prices, known symbol, mint address format
- [x] `markets.ts` normalize to internal `Market` type, apply denylist
- [x] `prices.ts` spot / mark / premium / implied valuation / liquidity
- [x] `twap.ts` rolling 5-min TWAP + guard checks
- [x] Unit tests with a recorded fixture

## Phase 2 — Anchor program (P0)

- [x] State: `Protocol`, `Market` (price feed lives in the market account), `Position`, `LpPosition`, vault PDAs
- [x] `initialize_protocol`, `create_market`, `update_market_config`, `pause_market`
- [x] `update_price` — authorized publisher, staleness, max-move guard
- [x] `deposit_liquidity` (seed vault) — needed for OI cap
- [x] `open_position` — leverage 1–5x, min margin, max size, max OI, fee, liq price
- [x] `close_position` — fixed-point PnL, fee, payout capped by vault
- [x] `liquidate` — permissionless, liquidator reward, remainder to vault/insurance
- [x] Events emitted for open/close/liquidate
- [x] Tests: long, short, close both, add-to-position, stale price, unauthorized publisher/admin, wrong owner close, leverage/size/OI/liquidity caps, liquidation, price clamp, funding, pause
- [ ] Tests still missing: wrong collateral mint, explicit overflow cases
- [x] Deploy to devnet

## Phase 3 — Keeper (P0)

- [x] Price loop: Jupiter spot every ~10s → TWAP → guards → `update_price` per market
- [x] Event listener → Supabase (`trades`, `positions`, `prices`)
- [x] Liquidation loop: scan positions, call `liquidate`
- [ ] Deploy (Railway/Fly/Render)

## Phase 4 — Supabase (P0)

- [x] Tables: `markets`, `prices`, `trades` (open/close/liquidate history), `keeper_state`, `faucet_claims`
- [x] RLS: public read, service-role write
- [x] Price history for charts (GeckoTerminal candles, scaled-UI aware) + keeper `prices` table

## Phase 5 — Frontend (P0)

- [x] Next.js + Tailwind + Roboto/Playfair + Framer Motion + Hugeicons, `#081231` dark theme
- [x] Privy Solana wallet connect (external + embedded). Login flow not yet tested in a real browser
- [x] USDC faucet button (devnet)
- [x] Market selector + mark price + implied valuation + premium
- [x] Price chart
- [x] Trade panel: margin, leverage, LONG/SHORT, size, entry, fee, liq price, total (wallet prompt is the confirm step; no extra modal)
- [x] Positions table with live PnL/ROE, liq price, funding + CLOSE; entry/liq lines on chart
- [x] Portfolio: balance, available/used margin, uPnL
- [x] Trade history
- [ ] Deploy to Vercel

## Phase 6 — P1 (only after P0 end-to-end works)

- [x] Funding (OI skew, bounded, cumulative index)
- [x] LP vault deposit/withdraw UI (`/earn`)
- [x] Market stats (OI long/short, funding, vault, SPV mark premium, implied valuation)

## Phase 7 — Submission

- [x] README: what, why Solana, architecture, how to test on devnet, open-source credits
- [ ] 2–3 min demo video following the PRD success-criteria flow
- [ ] Live demo URL + GitHub link
- [ ] Submit on hackathons.solana.com + tag PreStocks bounty

---

## Devnet state

| Item | Value |
|------|-------|
| Program | `3drNH9yAW1yum78fo2ire96LXLcqzHUFzdkwDpdK3Zrh` |
| Test USDC mint | `9nfRPucZzZjTpKXniuQpf7hij5LYKEYaur687MZCmV3w` (authority: faucet key) |
| Keeper | `5n9sYitJJqaRo5z6mJMbGiyYJ9j8bwcBv1UoZHpHDxdp` |
| Faucet | `FBytcMZDXAbEdqK4YkyCCN9gT9Db8UcmziyX8TR9stDC` |
| Markets | ANTHROPIC, OPENAI, ANDURIL, NEURALINK, FIGUREAI, KALSHI, POLYMARKET (100k USDC LP each) |

## Tests

- Program: 3 math unit + 12 LiteSVM integration (`cargo test -p parity`)
- Adapter: 9 (`packages/prestocks`), SDK: 8 (`packages/sdk`)
- E2E on devnet: `pnpm --filter @parity/keeper e2e` (faucet → long → close → history → short) passing

## Log

- **2026-09-23** — Read both PRDs. Verified API: ANDURIL, ANTHROPIC, FIGUREAI, KALSHI, NEURALINK, OPENAI, POLYMARKET, SPACEX. Mark vs token premium is large on some (OPENAI token +28%, NEURALINK +30%). Created tracker.
- **2026-09-23**: Oracle decided (D7). Jupiter `usdPrice` = PreStocks `tokenPrice`; Jupiter `stockData.price` = mark. Name kept. No shock tool.
- **2026-09-23**: Program deployed to devnet, 15 tests green. Bootstrap created USDC mint, protocol, 7 markets with 100k LP each. Keeper publishing TWAP prices on-chain. App built: trade terminal, portfolio, earn, faucet, Privy. E2E passes. Found and fixed: OPENAI Token-2022 UI multiplier (1.486x) in DEX candles; raw-IDL enum casing in events.

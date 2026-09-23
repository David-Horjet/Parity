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

- [ ] `.env` uses `//` comments — switch to `#` (dotenv ignores `//` lines inconsistently)
- [ ] Add `NEXT_PUBLIC_PRIVY_APP_ID` (client needs the public prefix)
- [ ] Add `SOLANA_RPC_URL`, `KEEPER_KEYPAIR`, `PROGRAM_ID`, `USDC_MINT`

---

## Phase 0 — Recon & setup

- [x] Inspect PreStocks API schema (`/api/prestocks`, 8 assets, no auth, `max-age=0`)
- [x] Oracle source chosen (D7): mark moves in small steps every few minutes; Jupiter spot moves ±2–4%/24h
- [ ] Monorepo: `app/` (Next.js), `programs/parity` (Anchor), `keeper/` (Node), `packages/prestocks` (adapter)
- [ ] Anchor + Solana CLI toolchain working locally, devnet wallet funded

## Phase 1 — PreStocks adapter (P0)

- [ ] `client.ts` PreStocks + Jupiter Price v3 fetch, timeout, retry
- [ ] `validation.ts` zod schema, positive finite prices, known symbol, mint address format
- [ ] `markets.ts` normalize to internal `Market` type, apply denylist
- [ ] `prices.ts` spot / mark / premium / implied valuation / liquidity
- [ ] `twap.ts` rolling 5-min TWAP + guard checks
- [ ] Unit tests with a recorded fixture

## Phase 2 — Anchor program (P0)

- [ ] State: `Protocol`, `Market`, `PriceFeed`, `Position`, vault PDAs
- [ ] `initialize_protocol`, `create_market`, `update_market_config`, `pause_market`
- [ ] `update_price` — authorized publisher, staleness, max-move guard
- [ ] `deposit_liquidity` (seed vault) — needed for OI cap
- [ ] `open_position` — leverage 1–5x, min margin, max size, max OI, fee, liq price
- [ ] `close_position` — fixed-point PnL, fee, payout capped by vault
- [ ] `liquidate` — permissionless, liquidator reward, remainder to vault/insurance
- [ ] Events emitted for open/close/liquidate
- [ ] Tests: long, short, close both, stale price, unauthorized publisher/admin, wrong mint, max OI, liquidation paths, overflow
- [ ] Deploy to devnet

## Phase 3 — Keeper (P0)

- [ ] Price loop: Jupiter spot every ~10s → TWAP → guards → `update_price` per market
- [ ] Event listener → Supabase (`trades`, `positions`, `prices`)
- [ ] Liquidation loop: scan positions, call `liquidate`
- [ ] Deploy (Railway/Fly/Render)

## Phase 4 — Supabase (P0)

- [ ] Tables: `markets`, `prices`, `trades`, `positions_history`
- [ ] RLS: public read, service-role write
- [ ] Price history backfill for charts

## Phase 5 — Frontend (P0)

- [ ] Next.js + Tailwind + Roboto/Playfair + Framer Motion + Hugeicons, `#081231` dark theme
- [ ] Privy Solana wallet connect
- [ ] USDC faucet button (devnet)
- [ ] Market selector + mark price + implied valuation + premium
- [ ] Price chart
- [ ] Trade panel: margin, leverage, LONG/SHORT, size, fee, liq price, confirm modal
- [ ] Open position card with live PnL + CLOSE
- [ ] Portfolio: balance, available/used margin, uPnL
- [ ] Trade history
- [ ] Deploy to Vercel

## Phase 6 — P1 (only after P0 end-to-end works)

- [ ] Funding (OI skew, bounded; optionally premium-based)
- [ ] LP vault deposit/withdraw UI
- [ ] Market stats (OI long/short, vault size, 24h volume)

## Phase 7 — Submission

- [ ] README: what, why Solana, architecture, how to test on devnet, open-source credits
- [ ] 2–3 min demo video following the PRD success-criteria flow
- [ ] Live demo URL + GitHub link
- [ ] Submit on hackathons.solana.com + tag PreStocks bounty

---

## Log

- **2026-09-23** — Read both PRDs. Verified API: ANDURIL, ANTHROPIC, FIGUREAI, KALSHI, NEURALINK, OPENAI, POLYMARKET, SPACEX. Mark vs token premium is large on some (OPENAI token +28%, NEURALINK +30%). Created tracker.
- **2026-09-23**: Oracle decided (D7). Jupiter `usdPrice` = PreStocks `tokenPrice`; Jupiter `stockData.price` = mark. Name kept. No shock tool.

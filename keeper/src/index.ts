/**
 * Parity keeper:
 *  - publishes a guarded 5-min TWAP of Jupiter spot prices on-chain
 *  - liquidates unhealthy positions
 *  - indexes trade events and price history into Supabase
 */
import { createClient } from "@supabase/supabase-js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import {
  Twap,
  fetchJupiterPrices,
  fetchPreStocksAssets,
  toMarkets,
  toOnchainPrice,
  toSample,
  type MarketInfo,
  type PriceSample,
} from "@parity/prestocks";
import {
  PROGRAM_ID,
  bpsOf,
  fetchMarkets,
  fetchPositions,
  getProgram,
  liquidateIx,
  parseTradeEvents,
  positionEquity,
  projectedFundingIndex,
  updatePriceIx,
  type MarketView,
} from "@parity/sdk";
import { connection, loadKeypair, required, usdcMint } from "./env";
import { log, send } from "./tx";

const PRICE_INTERVAL_MS = 10_000;
const HISTORY_INTERVAL_MS = 30_000;
const MARKETS_INTERVAL_MS = 5 * 60_000;

const conn = connection();
const keeper = loadKeypair("KEEPER_KEYPAIR", ".keys/keeper.json");
const program = getProgram(conn, keeper.publicKey);
const usdc = usdcMint();
const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

interface Tracked {
  info: MarketInfo;
  address: PublicKey;
  twap: Twap;
  last?: PriceSample;
  index?: number;
}

const tracked = new Map<string, Tracked>();
const symbolByMarket = new Map<string, string>();

async function refreshMarkets() {
  const [infos, onchain] = await Promise.all([fetchPreStocksAssets().then(toMarkets), fetchMarkets(program)]);
  const bySymbol = new Map(onchain.map((m) => [m.symbol, m]));
  for (const info of infos) {
    const m = bySymbol.get(info.symbol);
    if (!m) continue;
    const existing = tracked.get(info.symbol);
    tracked.set(info.symbol, { ...existing, info, address: m.address, twap: existing?.twap ?? new Twap() });
    symbolByMarket.set(m.address.toBase58(), info.symbol);
  }
  const { error } = await db.from("markets").upsert(
    infos
      .filter((i) => bySymbol.has(i.symbol))
      .map((i) => ({
        symbol: i.symbol,
        name: i.name,
        description: i.description,
        image: i.image,
        url: i.url,
        mint: i.mint,
        market_address: bySymbol.get(i.symbol)!.address.toBase58(),
        mark_price: i.markPrice,
        token_price: i.tokenPrice,
        mark_valuation: i.markValuation,
        implied_valuation: i.impliedValuation,
        updated_at: new Date().toISOString(),
      })),
  );
  if (error) log("markets", "upsert failed", error.message);
  log("markets", `tracking ${tracked.size}: ${[...tracked.keys()].join(", ")}`);
}

async function publishPrices() {
  const list = [...tracked.values()];
  const prices = await fetchJupiterPrices(list.map((t) => t.info.mint));
  const now = Date.now();
  const ixs = [];
  for (const t of list) {
    const sample = toSample(t.info, prices[t.info.mint], now);
    if (!sample) continue;
    const rejected = t.twap.push(sample, now);
    if (rejected) log("price", `${t.info.symbol} sample rejected: ${rejected}`);
    t.last = sample;
    const value = t.twap.value(now);
    if (value === null) continue;
    t.index = value;
    ixs.push(await updatePriceIx(program, keeper.publicKey, t.address, toOnchainPrice(value)));
  }
  if (ixs.length > 0) await send(conn, keeper, ixs);
}

async function recordHistory() {
  const now = new Date().toISOString();
  const rows = [...tracked.values()]
    .filter((t) => t.last && t.index)
    .map((t) => ({ symbol: t.info.symbol, ts: now, index_price: t.index!, spot: t.last!.spot, mark: t.last!.mark }));
  if (rows.length === 0) return;
  const { error } = await db.from("prices").insert(rows);
  if (error) log("history", "insert failed", error.message);
  for (const t of tracked.values()) {
    if (!t.last) continue;
    await db
      .from("markets")
      .update({
        mark_price: t.last.mark,
        token_price: t.last.spot,
        change_24h: t.last.change24h,
        liquidity: t.last.liquidity,
        updated_at: now,
      })
      .eq("symbol", t.info.symbol);
  }
}

let keeperAtaReady = false;

async function liquidate(markets: MarketView[]) {
  const byAddress = new Map(markets.map((m) => [m.address.toBase58(), m]));
  const positions = await fetchPositions(program);
  const now = Math.floor(Date.now() / 1000);
  for (const p of positions) {
    const m = byAddress.get(p.market.toBase58());
    if (!m || m.price === 0n || now - m.priceUpdatedAt > m.config.maxPriceAgeSecs) continue;
    const index = projectedFundingIndex(
      { ...m, maxFundingRateBpsPerHour: m.config.maxFundingRateBpsPerHour },
      now,
    );
    const { equity } = positionEquity(p, m.price, index);
    if (equity >= bpsOf(p.size, m.config.maintenanceMarginBps)) continue;

    const ixs = [];
    if (!keeperAtaReady) {
      const ata = getAssociatedTokenAddressSync(usdc, keeper.publicKey);
      ixs.push(createAssociatedTokenAccountIdempotentInstruction(keeper.publicKey, ata, keeper.publicKey, usdc));
    }
    ixs.push(
      await liquidateIx(program, {
        liquidator: keeper.publicKey,
        owner: p.owner,
        market: p.market,
        side: p.side,
        collateralMint: usdc,
      }),
    );
    try {
      const sig = await send(conn, keeper, ixs);
      keeperAtaReady = true;
      log("liquidate", `${m.symbol} ${p.side} ${p.owner.toBase58()} ${sig}`);
    } catch (err) {
      log("liquidate", `failed ${p.address.toBase58()}`, (err as Error).message);
    }
  }
}

async function indexSignature(signature: string, logs: string[]) {
  const rows = parseTradeEvents(signature, logs, symbolByMarket);
  if (rows.length === 0) return;
  const { error } = await db.from("trades").upsert(rows, { onConflict: "signature,event_index" });
  if (error) log("index", "upsert failed", error.message);
  else log("index", `${rows.map((r) => `${r.kind} ${r.symbol} ${r.side}`).join(", ")} ${signature}`);
}

function subscribeEvents() {
  conn.onLogs(
    PROGRAM_ID,
    (res) => {
      if (res.err) return;
      if (!res.logs.some((l) => /Position(Opened|Closed|Liquidated)|Instruction: (Open|Close)Position|Instruction: Liquidate/.test(l))) return;
      indexSignature(res.signature, res.logs).catch((err) => log("index", (err as Error).message));
    },
    "confirmed",
  );
}

function every(ms: number, name: string, fn: () => Promise<void>) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      log(name, "error", (err as Error).message);
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(tick, ms);
}

// RPC and API calls fail transiently (timeouts, 429s); a long-running keeper
// must log those and keep going rather than exit.
process.on("unhandledRejection", (err) => log("keeper", "unhandled rejection", (err as Error)?.message ?? err));
process.on("uncaughtException", (err) => log("keeper", "uncaught exception", err.message));

async function main() {
  log("keeper", `keeper ${keeper.publicKey.toBase58()} program ${PROGRAM_ID.toBase58()}`);
  await refreshMarkets();
  subscribeEvents();
  every(MARKETS_INTERVAL_MS, "markets", refreshMarkets);
  every(PRICE_INTERVAL_MS, "price", async () => {
    await publishPrices();
    await liquidate(await fetchMarkets(program));
  });
  every(HISTORY_INTERVAL_MS, "history", recordHistory);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

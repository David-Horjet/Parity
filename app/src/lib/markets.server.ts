import "server-only";
import { unpackAccount } from "@solana/spl-token";
import { fetchMarkets, fetchPositions } from "@parity/sdk";
import { fetchPreStocksAssets, toMarkets } from "@parity/prestocks";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./config";
import { cached, db, parity } from "./server";
import type { MarketDTO, PositionDTO } from "./types";

interface MetaRow {
  symbol: string;
  name: string;
  description: string;
  image: string;
  url: string;
  mint: string;
  mark_price: number | null;
  token_price: number | null;
  mark_valuation: number | null;
  implied_valuation: number | null;
  change_24h: number | null;
}

async function metadata(): Promise<Map<string, MetaRow & { supply: number | null }>> {
  const [rows, live] = await Promise.all([
    db()
      .from("markets")
      .select("*")
      .then((r) => (r.data ?? []) as MetaRow[]),
    cached("prestocks", 60_000, () => fetchPreStocksAssets().then(toMarkets)).catch(() => []),
  ]);
  const out = new Map<string, MetaRow & { supply: number | null }>();
  for (const m of live) {
    out.set(m.symbol, {
      symbol: m.symbol,
      name: m.name,
      description: m.description,
      image: m.image,
      url: m.url,
      mint: m.mint,
      mark_price: m.markPrice,
      token_price: m.tokenPrice,
      mark_valuation: m.markValuation,
      implied_valuation: m.impliedValuation,
      change_24h: null,
      supply: m.supply,
    });
  }
  // Keeper rows carry fresher Jupiter prices and 24h change.
  for (const r of rows) out.set(r.symbol, { ...out.get(r.symbol), ...r, supply: out.get(r.symbol)?.supply ?? null });
  return out;
}

export function getMarkets(): Promise<MarketDTO[]> {
  return cached("markets", 2_000, async () => {
    const program = parity();
    const [onchain, meta] = await Promise.all([fetchMarkets(program), cached("meta", 15_000, metadata)]);
    const vaults = await getConnection().getMultipleAccountsInfo(onchain.map((m) => m.vault));
    return onchain
      .map((m, i): MarketDTO | null => {
        const info = meta.get(m.symbol);
        if (!info) return null;
        const vault = vaults[i] ? unpackAccount(m.vault, vaults[i]!).amount : 0n;
        const markValuation = info.mark_valuation;
        const supplyRatio = info.mark_price && markValuation ? markValuation / info.mark_price : null;
        return {
          symbol: m.symbol,
          name: info.name,
          description: info.description,
          image: info.image,
          url: info.url,
          mint: info.mint,
          address: m.address.toBase58(),
          paused: m.paused,
          price: m.price.toString(),
          priceUpdatedAt: m.priceUpdatedAt,
          markPrice: info.mark_price,
          tokenPrice: info.token_price,
          markValuation,
          // Valuation implied by the perp's index price, using PreStocks' share count.
          impliedValuation: supplyRatio ? (Number(m.price) / 1e6) * supplyRatio : info.implied_valuation,
          change24h: info.change_24h,
          supply: info.supply,
          longSize: m.longSize.toString(),
          shortSize: m.shortSize.toString(),
          longQty: m.longQty.toString(),
          shortQty: m.shortQty.toString(),
          longFundingEntry: m.longFundingEntry.toString(),
          shortFundingEntry: m.shortFundingEntry.toString(),
          totalMargin: m.totalMargin.toString(),
          fundingIndex: m.fundingIndex.toString(),
          fundingUpdatedAt: m.fundingUpdatedAt,
          vaultBalance: vault.toString(),
          lpShares: m.lpShares.toString(),
          config: {
            maxLeverage: m.config.maxLeverage,
            maintenanceMarginBps: m.config.maintenanceMarginBps,
            tradingFeeBps: m.config.tradingFeeBps,
            liquidationFeeBps: m.config.liquidationFeeBps,
            minMargin: m.config.minMargin.toString(),
            maxPositionSize: m.config.maxPositionSize.toString(),
            maxOpenInterest: m.config.maxOpenInterest.toString(),
            maxOiToLiquidityBps: m.config.maxOiToLiquidityBps,
            maxPriceAgeSecs: m.config.maxPriceAgeSecs,
            maxFundingRateBpsPerHour: m.config.maxFundingRateBpsPerHour,
          },
        };
      })
      .filter((m): m is MarketDTO => m !== null)
      .sort((a, b) => (b.markValuation ?? 0) - (a.markValuation ?? 0));
  });
}

export async function getPositions(owner: PublicKey): Promise<PositionDTO[]> {
  const [positions, markets] = await Promise.all([fetchPositions(parity(), owner), getMarkets()]);
  const symbols = new Map(markets.map((m) => [m.address, m.symbol]));
  return positions.map((p) => ({
    address: p.address.toBase58(),
    owner: p.owner.toBase58(),
    market: p.market.toBase58(),
    symbol: symbols.get(p.market.toBase58()) ?? "?",
    side: p.side,
    margin: p.margin.toString(),
    size: p.size.toString(),
    qty: p.qty.toString(),
    fundingEntry: p.fundingEntry.toString(),
    openedAt: p.openedAt,
  }));
}

export async function getLpPositions(owner: PublicKey) {
  const [all, markets] = await Promise.all([
    parity().account.lpPosition.all([{ memcmp: { offset: 8, bytes: owner.toBase58() } }]),
    getMarkets(),
  ]);
  const symbols = new Map(markets.map((m) => [m.address, m.symbol]));
  return all
    .filter((a) => BigInt(a.account.shares.toString()) > 0n)
    .map((a) => ({
      market: a.account.market.toBase58(),
      symbol: symbols.get(a.account.market.toBase58()) ?? "?",
      shares: a.account.shares.toString(),
    }));
}

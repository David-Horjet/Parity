import type { MarketInfo } from "./markets";
import type { JupiterPrice } from "./validation";

export interface PriceSample {
  symbol: string;
  mint: string;
  /** Jupiter executable spot price, USD. */
  spot: number;
  /** PreStocks SPV mark price, USD. */
  mark: number;
  /** Spot premium over mark, as a fraction. */
  premium: number;
  liquidity: number;
  change24h: number | null;
  /** Unix ms. */
  timestamp: number;
}

export function premium(spot: number, mark: number) {
  return spot / mark - 1;
}

/**
 * Jupiter carries both prices; PreStocks' own mark is the fallback when
 * Jupiter's stockData block is missing.
 */
export function toSample(market: MarketInfo, jup: JupiterPrice | undefined, now = Date.now()): PriceSample | null {
  if (!jup) return null;
  const mark = jup.stockData?.price ?? market.markPrice;
  return {
    symbol: market.symbol,
    mint: market.mint,
    spot: jup.usdPrice,
    mark,
    premium: premium(jup.usdPrice, mark),
    liquidity: jup.liquidity,
    change24h: jup.priceChange24h ?? null,
    timestamp: now,
  };
}

/** USD float to on-chain 6-decimal integer. */
export function toOnchainPrice(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error(`invalid price ${usd}`);
  return BigInt(Math.round(usd * 1_000_000));
}

export interface ScaledUiConfig {
  multiplier?: number;
  newMultiplier?: number;
  newMultiplierEffectiveAt?: string;
}

/**
 * Token-2022 scaled-UI tokens: DEX feeds that report raw (pre-scaled) prices need
 * dividing by the multiplier in force at that time to match UI prices.
 */
export function uiMultiplierAt(cfg: ScaledUiConfig | undefined, unixSecs: number): number {
  if (!cfg) return 1;
  const effective = cfg.newMultiplierEffectiveAt ? Date.parse(cfg.newMultiplierEffectiveAt) / 1000 : Infinity;
  const m = unixSecs >= effective ? cfg.newMultiplier : cfg.multiplier;
  return m && m > 0 ? m : 1;
}

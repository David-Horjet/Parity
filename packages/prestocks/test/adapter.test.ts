import { describe, expect, it } from "vitest";
import prestocks from "./fixtures/prestocks.json";
import jupiter from "./fixtures/jupiter.json";
import {
  DEFAULT_GUARDS,
  Twap,
  parseEach,
  preStocksAssetSchema,
  toMarkets,
  toOnchainPrice,
  toSample,
  jupiterPriceSchema,
  type PriceSample,
} from "../src";

const assets = parseEach(prestocks as unknown[], preStocksAssetSchema).ok;

describe("markets", () => {
  it("parses every live asset", () => {
    expect(assets.length).toBe((prestocks as unknown[]).length);
  });

  it("excludes SPACEX and strips names", () => {
    const markets = toMarkets(assets);
    expect(markets.find((m) => m.symbol === "SPACEX")).toBeUndefined();
    const openai = markets.find((m) => m.symbol === "OPENAI")!;
    expect(openai.name).toBe("OpenAI");
    expect(openai.mint).toBe("PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF");
    expect(openai.description).not.toMatch(/backed 1:1/);
  });

  it("rejects malformed assets without dropping the rest", () => {
    const bad = [{ ...(prestocks as any[])[0], markPrice: -1 }, (prestocks as any[])[1]];
    const res = parseEach(bad, preStocksAssetSchema);
    expect(res.ok.length).toBe(1);
    expect(res.rejected).toBe(1);
  });
});

describe("prices", () => {
  it("builds samples from Jupiter with mark from stockData", () => {
    const market = toMarkets(assets).find((m) => m.symbol === "KALSHI")!;
    const jup = jupiterPriceSchema.parse((jupiter as any)[market.mint]);
    const s = toSample(market, jup, 0)!;
    expect(s.spot).toBe(jup.usdPrice);
    expect(s.mark).toBe(jup.stockData!.price);
    expect(s.premium).toBeCloseTo(jup.usdPrice / jup.stockData!.price - 1);
  });

  it("converts to 6-decimal integers", () => {
    expect(toOnchainPrice(1326.95981855)).toBe(1_326_959_819n);
    expect(() => toOnchainPrice(0)).toThrow();
  });
});

describe("twap", () => {
  const sample = (spot: number, t: number, extra: Partial<PriceSample> = {}): PriceSample => ({
    symbol: "X",
    mint: "m",
    spot,
    mark: 100,
    premium: spot / 100 - 1,
    liquidity: 100_000,
    change24h: 0,
    timestamp: t,
    ...extra,
  });

  it("weights by time", () => {
    const twap = new Twap();
    const t0 = 1_000_000;
    twap.push(sample(100, t0), t0);
    twap.push(sample(100, t0 + 10_000), t0 + 10_000);
    twap.push(sample(110, t0 + 20_000), t0 + 20_000);
    // 20s at 100, 20s at 110.
    expect(twap.value(t0 + 40_000)).toBeCloseTo(105);
  });

  it("needs minimum samples and fresh data", () => {
    const twap = new Twap();
    twap.push(sample(100, 0), 0);
    expect(twap.value(1)).toBeNull();
    twap.push(sample(100, 1), 1);
    twap.push(sample(100, 2), 2);
    expect(twap.value(3)).toBe(100);
    expect(twap.value(2 + DEFAULT_GUARDS.maxSampleAgeMs + 1)).toBeNull();
  });

  it("rejects thin liquidity and extreme premium", () => {
    const twap = new Twap();
    expect(twap.push(sample(100, 0, { liquidity: 1_000 }), 0)).toBe("liquidity");
    expect(twap.push(sample(200, 0), 0)).toBe("premium");
    expect(twap.size).toBe(0);
  });

  it("drops samples outside the window", () => {
    const twap = new Twap();
    for (let i = 0; i < 40; i++) twap.push(sample(100 + i, i * 10_000), i * 10_000);
    const now = 39 * 10_000;
    expect(twap.size).toBeLessThanOrEqual(32);
    const v = twap.value(now)!;
    expect(v).toBeGreaterThan(100 + 9);
  });
});

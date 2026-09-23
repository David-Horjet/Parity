import { describe, expect, it } from "vitest";
import {
  acceptablePrice,
  entryPrice,
  fundingOwed,
  liquidationPrice,
  marketPda,
  pnl,
  positionEquity,
  projectedFundingIndex,
  qtyFor,
  quoteOpen,
  symbolBytes,
} from "../src";

const usd = (v: number) => BigInt(v) * 1_000_000n;

describe("math mirrors the program", () => {
  it("pnl and entry", () => {
    const qty = qtyFor(usd(500), usd(100));
    expect(qty).toBe(5_000_000_000n);
    expect(pnl("long", usd(500), qty, usd(110))).toBe(usd(50));
    expect(pnl("short", usd(500), qty, usd(110))).toBe(-usd(50));
    expect(entryPrice(usd(420), 4_000_000_000n)).toBe(usd(105));
  });

  it("short re-entry loss matches integration test", () => {
    const qty = qtyFor(usd(1000), usd(95));
    expect(pnl("short", usd(1000), qty, usd(100))).toBe(-52_631_578n);
  });

  it("liquidation price sits where equity equals maintenance", () => {
    const pos = { side: "long" as const, margin: usd(100), size: usd(500), qty: 5_000_000_000n, fundingEntry: 0n };
    const liq = liquidationPrice(pos, 500);
    expect(liq).toBe(usd(85));
    // Program's liquidation test: $84 liquidatable, $90 not.
    expect(positionEquity(pos, usd(84), 0n).equity < usd(25)).toBe(true);
    expect(positionEquity(pos, usd(90), 0n).equity < usd(25)).toBe(false);

    const short = { ...pos, side: "short" as const };
    expect(liquidationPrice(short, 500)).toBe(usd(115));
  });

  it("funding", () => {
    expect(fundingOwed("long", usd(1000), 0n, 10_000_000_000n)).toBe(usd(10));
    const idx = projectedFundingIndex(
      { longSize: usd(1000), shortSize: 0n, fundingIndex: 0n, fundingUpdatedAt: 0, maxFundingRateBpsPerHour: 10 },
      3600,
    );
    expect(fundingOwed("long", usd(1000), 0n, idx)).toBe(usd(1));
  });

  it("quotes", () => {
    const q = quoteOpen("long", usd(100), 5, usd(100), { tradingFeeBps: 10, maintenanceMarginBps: 500 });
    expect(q.size).toBe(usd(500));
    expect(q.fee).toBe(500_000n);
    expect(q.total).toBe(usd(100) + 500_000n);
    expect(q.liquidationPrice).toBe(usd(85));
  });

  it("slippage bounds", () => {
    expect(acceptablePrice("long", true, usd(100), 100)).toBe(usd(101));
    expect(acceptablePrice("short", true, usd(100), 100)).toBe(usd(99));
    expect(acceptablePrice("long", false, usd(100), 100)).toBe(usd(99));
    expect(acceptablePrice("short", false, usd(100), 100)).toBe(usd(101));
  });

  it("pdas and symbols", () => {
    expect(symbolBytes("AB").slice(0, 3)).toEqual([65, 66, 0]);
    expect(() => symbolBytes("ab")).toThrow();
    expect(marketPda("OPENAI").toBase58()).toHaveLength(44);
  });
});

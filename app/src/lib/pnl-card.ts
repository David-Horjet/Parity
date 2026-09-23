import type { LivePosition } from "./position";
import type { TradeDTO } from "./types";

/** Everything a PnL card shows; serialized into the card image and share URLs. */
export interface PnlCard {
  symbol: string;
  side: "long" | "short";
  leverage: number;
  entry: number;
  exit: number;
  pnl: number;
  roe: number;
  margin: number;
  /** Unix seconds: close time, or when an open position's card was made. */
  time: number;
  open?: boolean;
  liquidated?: boolean;
}

const round = (v: number, digits = 6) => String(Number(v.toFixed(digits)));

export function toQuery(c: PnlCard): string {
  const q = new URLSearchParams({
    s: c.symbol,
    d: c.side,
    l: round(c.leverage, 2),
    e: round(c.entry),
    x: round(c.exit),
    p: round(c.pnl, 2),
    r: round(c.roe, 4),
    m: round(c.margin, 2),
    t: String(c.time),
  });
  if (c.open) q.set("o", "1");
  if (c.liquidated) q.set("q", "1");
  return q.toString();
}

export function fromQuery(q: URLSearchParams): PnlCard | null {
  const num = (k: string) => Number(q.get(k));
  const card: PnlCard = {
    symbol: (q.get("s") ?? "").toUpperCase().slice(0, 16),
    side: q.get("d") === "short" ? "short" : "long",
    leverage: num("l"),
    entry: num("e"),
    exit: num("x"),
    pnl: num("p"),
    roe: num("r"),
    margin: num("m"),
    time: Math.floor(num("t")),
    open: q.get("o") === "1",
    liquidated: q.get("q") === "1",
  };
  const nums = [card.leverage, card.entry, card.exit, card.pnl, card.roe, card.margin, card.time];
  if (!card.symbol || nums.some((n) => !Number.isFinite(n))) return null;
  return card;
}

export function cardFromPosition(p: LivePosition): PnlCard {
  return {
    symbol: p.market.symbol,
    side: p.position.side,
    leverage: p.leverage,
    entry: p.entry,
    exit: p.mark,
    pnl: p.pnl - p.funding,
    roe: p.roe,
    margin: p.margin,
    time: Math.floor(Date.now() / 1000),
    open: true,
  };
}

/** Card for a close or liquidation; opens have no realized PnL to show. */
export function cardFromTrade(t: TradeDTO): PnlCard | null {
  if (t.kind === "open" || t.pnl === null || !t.symbol || !t.entry_price) return null;
  const pnl = t.pnl - (t.funding ?? 0);
  return {
    symbol: t.symbol,
    side: t.side,
    leverage: t.margin ? t.size / t.margin : 1,
    entry: t.entry_price,
    exit: t.price,
    pnl,
    roe: t.margin ? pnl / t.margin : 0,
    margin: t.margin,
    time: Math.floor(Date.parse(t.ts) / 1000),
    liquidated: t.kind === "liquidate",
  };
}

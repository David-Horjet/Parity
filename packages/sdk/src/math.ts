import { BPS, FUNDING_SCALE, QTY_SCALE, type Side } from "./constants";

/** Mirrors programs/parity/src/math.rs. All amounts are 6-decimal integers. */

export const bpsOf = (amount: bigint, bps: number) => (amount * BigInt(bps)) / BPS;
export const qtyFor = (size: bigint, price: bigint) => (size * QTY_SCALE) / price;
export const valueOf = (qty: bigint, price: bigint) => (qty * price) / QTY_SCALE;
export const entryPrice = (size: bigint, qty: bigint) => (qty === 0n ? 0n : (size * QTY_SCALE) / qty);

export function pnl(side: Side, size: bigint, qty: bigint, price: bigint) {
  const value = valueOf(qty, price);
  return side === "long" ? value - size : size - value;
}

/** Truncates toward zero like Rust integer division. */
export function fundingOwed(side: Side, size: bigint, fundingEntry: bigint, index: bigint) {
  const accrued = (size * index - fundingEntry) / FUNDING_SCALE;
  return side === "long" ? accrued : -accrued;
}

export interface FundingState {
  longSize: bigint;
  shortSize: bigint;
  fundingIndex: bigint;
  fundingUpdatedAt: number;
  maxFundingRateBpsPerHour: number;
}

export function projectedFundingIndex(m: FundingState, now: number) {
  const dt = BigInt(Math.max(0, now - m.fundingUpdatedAt));
  const total = m.longSize + m.shortSize;
  if (dt === 0n || total === 0n || m.maxFundingRateBpsPerHour === 0) return m.fundingIndex;
  const delta =
    (FUNDING_SCALE * BigInt(m.maxFundingRateBpsPerHour) * (m.longSize - m.shortSize) * dt) /
    (total * BPS * 3600n);
  return m.fundingIndex + delta;
}

/** Hourly funding rate paid by longs (negative = longs receive), as a fraction. */
export function fundingRatePerHour(m: Pick<FundingState, "longSize" | "shortSize" | "maxFundingRateBpsPerHour">) {
  const total = m.longSize + m.shortSize;
  if (total === 0n) return 0;
  const skew = Number(m.longSize - m.shortSize) / Number(total);
  return (skew * m.maxFundingRateBpsPerHour) / 10_000;
}

export interface PositionLike {
  side: Side;
  margin: bigint;
  size: bigint;
  qty: bigint;
  fundingEntry: bigint;
}

export function positionEquity(p: PositionLike, price: bigint, index: bigint) {
  const upnl = pnl(p.side, p.size, p.qty, price);
  const funding = fundingOwed(p.side, p.size, p.fundingEntry, index);
  return { equity: p.margin + upnl - funding, pnl: upnl, funding };
}

/** Price at which equity hits maintenance margin, given funding owed so far. */
export function liquidationPrice(p: PositionLike, maintenanceBps: number, funding = 0n) {
  if (p.qty === 0n) return 0n;
  const mm = bpsOf(p.size, maintenanceBps);
  const num = p.side === "long" ? p.size + mm - p.margin + funding : p.size - mm + p.margin - funding;
  return num <= 0n ? 0n : (num * QTY_SCALE) / p.qty;
}

export interface OpenQuote {
  size: bigint;
  qty: bigint;
  fee: bigint;
  total: bigint;
  liquidationPrice: bigint;
}

export function quoteOpen(
  side: Side,
  margin: bigint,
  leverage: number,
  price: bigint,
  cfg: { tradingFeeBps: number; maintenanceMarginBps: number },
): OpenQuote {
  const size = (margin * BigInt(Math.round(leverage * 100))) / 100n;
  const qty = price > 0n ? qtyFor(size, price) : 0n;
  const fee = bpsOf(size, cfg.tradingFeeBps);
  return {
    size,
    qty,
    fee,
    total: margin + fee,
    liquidationPrice: liquidationPrice({ side, margin, size, qty, fundingEntry: 0n }, cfg.maintenanceMarginBps),
  };
}

export const toUsd = (v: bigint) => Number(v) / 1e6;
export const fromUsd = (v: number) => BigInt(Math.round(v * 1e6));

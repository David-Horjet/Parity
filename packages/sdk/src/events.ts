import { BorshCoder, EventParser } from "@anchor-lang/core";
import type { PublicKey } from "@solana/web3.js";
import idl from "./idl/parity.json";
import { PROGRAM_ID } from "./constants";
import { big, sideFromArg } from "./program";
import type { Parity } from "./idl/parity";

export interface TradeRow {
  signature: string;
  event_index: number;
  kind: "open" | "close" | "liquidate";
  owner: string;
  market: string;
  symbol: string | null;
  side: "long" | "short";
  margin: number;
  size: number;
  price: number;
  entry_price: number | null;
  pnl: number | null;
  funding: number | null;
  fee: number | null;
  payout: number | null;
  liquidator: string | null;
  ts: string;
}

const parser = new EventParser(PROGRAM_ID, new BorshCoder(idl as Parity));
const usd = (v: unknown) => Number(big(v as { toString(): string })) / 1e6;
const key = (v: unknown) => (v as PublicKey).toBase58();
const iso = (v: unknown) => new Date(Number(big(v as { toString(): string })) * 1000).toISOString();

/** Trade rows from a transaction's logs. Liquidity events are ignored. */
export function parseTradeEvents(
  signature: string,
  logs: string[],
  symbolByMarket: Map<string, string>,
): TradeRow[] {
  const rows: TradeRow[] = [];
  let index = 0;
  for (const ev of parser.parseLogs(logs)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = ev.data as any;
    const name = ev.name.charAt(0).toLowerCase() + ev.name.slice(1);
    const base = {
      signature,
      event_index: index++,
      owner: key(d.owner),
      market: key(d.market),
      symbol: symbolByMarket.get(key(d.market)) ?? null,
      side: sideFromArg(d.side),
      ts: iso(d.timestamp),
    };
    if (name === "positionOpened") {
      rows.push({
        ...base,
        kind: "open",
        margin: usd(d.marginAdded),
        size: usd(d.sizeAdded),
        price: usd(d.price),
        entry_price: usd(d.price),
        pnl: null,
        funding: null,
        fee: usd(d.fee),
        payout: null,
        liquidator: null,
      });
    } else if (name === "positionClosed") {
      rows.push({
        ...base,
        kind: "close",
        margin: usd(d.margin),
        size: usd(d.size),
        price: usd(d.exitPrice),
        entry_price: usd(d.entryPrice),
        pnl: usd(d.pnl),
        funding: usd(d.funding),
        fee: usd(d.fee),
        payout: usd(d.payout),
        liquidator: null,
      });
    } else if (name === "positionLiquidated") {
      rows.push({
        ...base,
        kind: "liquidate",
        margin: usd(d.margin),
        size: usd(d.size),
        price: usd(d.exitPrice),
        entry_price: usd(d.entryPrice),
        pnl: usd(d.pnl),
        funding: usd(d.funding),
        fee: usd(d.liquidatorReward),
        payout: 0,
        liquidator: key(d.liquidator),
      });
    }
  }
  return rows;
}

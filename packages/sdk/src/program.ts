import { AnchorProvider, Program } from "@anchor-lang/core";
import BN from "bn.js";
import {
  Connection,
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import idl from "./idl/parity.json";
import type { Parity } from "./idl/parity";
import type { Side } from "./constants";
import { symbolFromBytes } from "./pda";

export type ParityProgram = Program<Parity>;

/** Read-only wallet: instructions are built here and signed by the caller's wallet. */
class ReadonlyWallet {
  constructor(readonly publicKey: PublicKey) {}
  async signTransaction<T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> {
    throw new Error("read-only wallet");
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> {
    throw new Error("read-only wallet");
  }
}

export function getProgram(connection: Connection, payer: PublicKey = PublicKey.default): ParityProgram {
  const provider = new AnchorProvider(connection, new ReadonlyWallet(payer), { commitment: "confirmed" });
  return new Program(idl as Parity, provider);
}

export const sideArg = (side: Side) => (side === "long" ? { long: {} } : { short: {} });
export const sideFromArg = (v: object): Side => ("long" in v ? "long" : "short");

export const bn = (v: bigint | number) => new BN(v.toString());
export const big = (v: BN | { toString(): string }) => BigInt(v.toString());

export interface MarketConfigView {
  maxLeverage: number;
  maintenanceMarginBps: number;
  tradingFeeBps: number;
  liquidationFeeBps: number;
  minMargin: bigint;
  maxPositionSize: bigint;
  maxOpenInterest: bigint;
  maxOiToLiquidityBps: number;
  maxPriceAgeSecs: number;
  maxPriceMoveBps: number;
  maxFundingRateBpsPerHour: number;
}

export interface MarketView {
  address: PublicKey;
  symbol: string;
  assetMint: PublicKey;
  vault: PublicKey;
  config: MarketConfigView;
  paused: boolean;
  price: bigint;
  priceUpdatedAt: number;
  longSize: bigint;
  longQty: bigint;
  shortSize: bigint;
  shortQty: bigint;
  longFundingEntry: bigint;
  shortFundingEntry: bigint;
  totalMargin: bigint;
  fundingIndex: bigint;
  fundingUpdatedAt: number;
  lpShares: bigint;
}

export interface PositionView {
  address: PublicKey;
  owner: PublicKey;
  market: PublicKey;
  side: Side;
  margin: bigint;
  size: bigint;
  qty: bigint;
  fundingEntry: bigint;
  openedAt: number;
  updatedAt: number;
}

// Decoded Anchor accounts are loosely typed here to keep the mapping in one place.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function toMarketView(address: PublicKey, a: any): MarketView {
  const c = a.config;
  return {
    address,
    symbol: symbolFromBytes(a.symbol),
    assetMint: a.assetMint,
    vault: a.vault,
    config: {
      maxLeverage: c.maxLeverage,
      maintenanceMarginBps: c.maintenanceMarginBps,
      tradingFeeBps: c.tradingFeeBps,
      liquidationFeeBps: c.liquidationFeeBps,
      minMargin: big(c.minMargin),
      maxPositionSize: big(c.maxPositionSize),
      maxOpenInterest: big(c.maxOpenInterest),
      maxOiToLiquidityBps: c.maxOiToLiquidityBps,
      maxPriceAgeSecs: c.maxPriceAgeSecs,
      maxPriceMoveBps: c.maxPriceMoveBps,
      maxFundingRateBpsPerHour: c.maxFundingRateBpsPerHour,
    },
    paused: a.paused,
    price: big(a.price),
    priceUpdatedAt: Number(a.priceUpdatedAt),
    longSize: big(a.longSize),
    longQty: big(a.longQty),
    shortSize: big(a.shortSize),
    shortQty: big(a.shortQty),
    longFundingEntry: big(a.longFundingEntry),
    shortFundingEntry: big(a.shortFundingEntry),
    totalMargin: big(a.totalMargin),
    fundingIndex: big(a.fundingIndex),
    fundingUpdatedAt: Number(a.fundingUpdatedAt),
    lpShares: big(a.lpShares),
  };
}

export function toPositionView(address: PublicKey, a: any): PositionView {
  return {
    address,
    owner: a.owner,
    market: a.market,
    side: sideFromArg(a.side),
    margin: big(a.margin),
    size: big(a.size),
    qty: big(a.qty),
    fundingEntry: big(a.fundingEntry),
    openedAt: Number(a.openedAt),
    updatedAt: Number(a.updatedAt),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function fetchMarkets(program: ParityProgram): Promise<MarketView[]> {
  const all = await program.account.market.all();
  return all.map((m) => toMarketView(m.publicKey, m.account));
}

export async function fetchMarket(program: ParityProgram, address: PublicKey): Promise<MarketView | null> {
  const a = await program.account.market.fetchNullable(address);
  return a ? toMarketView(address, a) : null;
}

/** Owner sits right after the 8-byte discriminator. */
export async function fetchPositions(program: ParityProgram, owner?: PublicKey): Promise<PositionView[]> {
  const filters = owner ? [{ memcmp: { offset: 8, bytes: owner.toBase58() } }] : [];
  const all = await program.account.position.all(filters);
  return all.map((p) => toPositionView(p.publicKey, p.account));
}

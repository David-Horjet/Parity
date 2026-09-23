import { PublicKey } from "@solana/web3.js";
import idl from "./idl/parity.json";

export const PROGRAM_ID = new PublicKey(idl.address);

export const USDC_DECIMALS = 6;
export const PRICE_SCALE = 1_000_000n;
export const QTY_SCALE = 1_000_000_000n;
export const FUNDING_SCALE = 1_000_000_000_000n;
export const BPS = 10_000n;
export const SYMBOL_LEN = 16;

export const SEEDS = {
  protocol: Buffer.from("protocol"),
  market: Buffer.from("market"),
  vault: Buffer.from("vault"),
  position: Buffer.from("position"),
  lp: Buffer.from("lp"),
} as const;

export type Side = "long" | "short";

export const SIDE_BYTE: Record<Side, number> = { long: 0, short: 1 };

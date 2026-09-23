import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, SEEDS, SIDE_BYTE, SYMBOL_LEN, type Side } from "./constants";

export function symbolBytes(symbol: string): number[] {
  if (!/^[A-Z0-9]{1,16}$/.test(symbol)) throw new Error(`invalid symbol ${symbol}`);
  const out = new Array<number>(SYMBOL_LEN).fill(0);
  for (let i = 0; i < symbol.length; i++) out[i] = symbol.charCodeAt(i);
  return out;
}

export function symbolFromBytes(bytes: number[] | Uint8Array): string {
  return String.fromCharCode(...Array.from(bytes).filter((b) => b !== 0));
}

const find = (seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];

export const protocolPda = () => find([SEEDS.protocol]);
export const marketPda = (symbol: string) => find([SEEDS.market, Buffer.from(symbolBytes(symbol))]);
export const vaultPda = (market: PublicKey) => find([SEEDS.vault, market.toBuffer()]);
export const positionPda = (market: PublicKey, owner: PublicKey, side: Side) =>
  find([SEEDS.position, market.toBuffer(), owner.toBuffer(), Uint8Array.of(SIDE_BYTE[side])]);
export const lpPda = (market: PublicKey, owner: PublicKey) =>
  find([SEEDS.lp, market.toBuffer(), owner.toBuffer()]);

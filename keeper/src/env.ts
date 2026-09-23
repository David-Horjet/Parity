import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const root = resolve(import.meta.dirname, "../..");
config({ path: resolve(root, ".env"), quiet: true });

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

/** Keypair from a JSON array in env (deployments) or a file path (local). */
export function loadKeypair(envName: string, fallbackFile: string): Keypair {
  const raw = process.env[envName];
  if (raw?.trim().startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  const file = resolve(root, raw || fallbackFile);
  if (!existsSync(file)) throw new Error(`keypair not found: ${file}`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(file, "utf8"))));
}

export const rpcUrl = () => process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const connection = () => new Connection(rpcUrl(), "confirmed");
export const usdcMint = () => new PublicKey(required("NEXT_PUBLIC_USDC_MINT"));
export const rootDir = root;

import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Keypair } from "@solana/web3.js";
import { getProgram, type ParityProgram } from "@parity/sdk";
import { getConnection } from "./config";

let supabase: SupabaseClient | null = null;
export function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  supabase ??= createClient(url, key, { auth: { persistSession: false } });
  return supabase;
}

let program: ParityProgram | null = null;
export function parity() {
  program ??= getProgram(getConnection());
  return program;
}

/** JSON array in env on hosted deploys; file path locally. */
export function faucetKeypair(): Keypair {
  const raw = process.env.FAUCET_KEYPAIR || ".keys/faucet.json";
  if (raw.trim().startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  const path = resolve(/*turbopackIgnore: true*/ process.cwd(), "..", raw);
  if (!existsSync(path)) throw new Error("faucet keypair missing");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

/** Small in-process TTL cache so polling clients share RPC/API calls. */
export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = fn().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

export const json = (data: unknown, init?: ResponseInit) => Response.json(data, init);
export const error = (message: string, status = 400) => Response.json({ error: message }, { status });

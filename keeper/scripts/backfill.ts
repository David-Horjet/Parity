/** Re-index trade events from the program's transaction history into Supabase. */
import { createClient } from "@supabase/supabase-js";
import { PROGRAM_ID, fetchMarkets, getProgram, parseTradeEvents } from "@parity/sdk";
import type { ConfirmedSignatureInfo } from "@solana/web3.js";
import { connection, required } from "../src/env";

const conn = connection();
const db = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const limit = Number(process.argv[2] ?? 2000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Public RPCs rate-limit hard; pace calls and back off on 429s. */
async function paced<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      await sleep(120);
      return await fn();
    } catch (err) {
      if (attempt >= 6 || !/429/.test(String(err))) throw err;
      await sleep(1_000 * 2 ** attempt);
    }
  }
}

async function main() {
  const symbols = new Map((await fetchMarkets(getProgram(conn))).map((m) => [m.address.toBase58(), m.symbol]));
  const sigs: ConfirmedSignatureInfo[] = [];
  let before: string | undefined;
  while (sigs.length < limit) {
    const page = await paced(() => conn.getSignaturesForAddress(PROGRAM_ID, { before, limit: 1000 }));
    if (page.length === 0) break;
    sigs.push(...page);
    before = page[page.length - 1]!.signature;
  }
  let indexed = 0;
  for (const s of sigs.filter((s) => !s.err)) {
    const tx = await paced(() =>
      conn.getTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }),
    );
    const logs = tx?.meta?.logMessages ?? [];
    // Price updates dominate history; skip them cheaply.
    if (!logs.some((l) => /Instruction: (OpenPosition|ClosePosition|Liquidate)/.test(l))) continue;
    const rows = parseTradeEvents(s.signature, logs, symbols);
    if (rows.length === 0) continue;
    const { error } = await db.from("trades").upsert(rows, { onConflict: "signature,event_index" });
    if (error) throw new Error(error.message);
    indexed += rows.length;
  }
  console.log(`scanned ${sigs.length} signatures, indexed ${indexed} trade events`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

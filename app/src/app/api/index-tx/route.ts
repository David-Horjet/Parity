import { parseTradeEvents } from "@parity/sdk";
import { getConnection } from "@/lib/config";
import { getMarkets } from "@/lib/markets.server";
import { db, error, json } from "@/lib/server";

/** Indexes a trade right after the client confirms it; the keeper also indexes from logs. */
export async function POST(req: Request) {
  const { signature } = (await req.json().catch(() => ({}))) as { signature?: string };
  if (!signature || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(signature)) return error("invalid signature");

  const tx = await getConnection().getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta || tx.meta.err) return error("transaction not found or failed", 404);

  const symbols = new Map((await getMarkets()).map((m) => [m.address, m.symbol]));
  const rows = parseTradeEvents(signature, tx.meta.logMessages ?? [], symbols);
  if (rows.length > 0) {
    const { error: err } = await db().from("trades").upsert(rows, { onConflict: "signature,event_index" });
    if (err) return error(err.message, 502);
  }
  return json({ indexed: rows.length });
}

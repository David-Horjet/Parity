import { db, error, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await ctx.params;
  const { data, error: err } = await db()
    .from("trades")
    .select("signature,kind,symbol,side,margin,size,price,entry_price,pnl,funding,fee,payout,ts")
    .eq("owner", wallet)
    .order("ts", { ascending: false })
    .limit(100);
  if (err) return error(err.message, 502);
  return json({ trades: data });
}

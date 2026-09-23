import { getMarkets } from "@/lib/markets.server";
import { error, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const market = (await getMarkets()).find((m) => m.symbol === symbol.toUpperCase());
  return market ? json({ market }) : error("market not found", 404);
}

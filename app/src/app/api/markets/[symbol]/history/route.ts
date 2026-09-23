import { fetchJupiterPrices, uiMultiplierAt } from "@parity/prestocks";
import { getMarkets } from "@/lib/markets.server";
import { cached, error, json } from "@/lib/server";
import type { Candle } from "@/lib/types";

export const dynamic = "force-dynamic";

const GT = "https://api.geckoterminal.com/api/v2/networks/solana";
const MAX_WICK = 0.08;
const TIMEFRAMES: Record<string, { path: string; aggregate: number }> = {
  "15m": { path: "minute", aggregate: 15 },
  "1h": { path: "hour", aggregate: 1 },
  "4h": { path: "hour", aggregate: 4 },
  "1d": { path: "day", aggregate: 1 },
};

async function gt<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);
  return res.json() as Promise<T>;
}

/** Deepest USDC pool for the token; DEX candles are the token's real trading history. */
function poolFor(mint: string) {
  return cached(`pool:${mint}`, 60 * 60_000, async () => {
    const res = await gt<{ data: { attributes: { address: string; name: string; reserve_in_usd: string } }[] }>(
      `${GT}/tokens/${mint}/pools?page=1`,
    );
    const pools = res.data.sort((a, b) => Number(b.attributes.reserve_in_usd) - Number(a.attributes.reserve_in_usd));
    const usdc = pools.find((p) => p.attributes.name.endsWith("/ USDC")) ?? pools[0];
    if (!usdc) throw new Error("no pool");
    return usdc.attributes.address;
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  const tf = new URL(req.url).searchParams.get("tf") ?? "1h";
  const frame = TIMEFRAMES[tf];
  if (!frame) return error("bad timeframe");
  const market = (await getMarkets()).find((m) => m.symbol === symbol.toUpperCase());
  if (!market) return error("market not found", 404);

  try {
    const candles = await cached(`candles:${market.mint}:${tf}`, 60_000, async () => {
      const [pool, jup] = await Promise.all([
        poolFor(market.mint),
        cached(`scaled:${market.mint}`, 10 * 60_000, () => fetchJupiterPrices([market.mint])),
      ]);
      const scaled = jup[market.mint]?.scaledUiConfig;
      const res = await gt<{ data: { attributes: { ohlcv_list: number[][] } } }>(
        `${GT}/pools/${pool}/ohlcv/${frame.path}?aggregate=${frame.aggregate}&limit=300&token=base&currency=usd`,
      );
      return res.data.attributes.ohlcv_list
        .map(([time, o, h, l, c]): Candle => {
          const m = uiMultiplierAt(scaled, time!);
          const open = o! / m;
          const close = c! / m;
          // Thin pools print occasional fat-finger trades; cap wicks so one print doesn't flatten the chart.
          const top = Math.max(open, close);
          const bottom = Math.min(open, close);
          return {
            time: time!,
            open,
            close,
            high: Math.min(h! / m, top * (1 + MAX_WICK)),
            low: Math.max(l! / m, bottom * (1 - MAX_WICK)),
          };
        })
        .sort((a, b) => a.time - b.time);
    });
    return json({ candles });
  } catch (err) {
    return error((err as Error).message, 502);
  }
}

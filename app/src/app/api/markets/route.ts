import { getMarkets } from "@/lib/markets.server";
import { error, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return json({ markets: await getMarkets() });
  } catch (err) {
    return error((err as Error).message, 502);
  }
}

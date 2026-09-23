import { PublicKey } from "@solana/web3.js";
import { getLpPositions } from "@/lib/markets.server";
import { error, json } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await ctx.params;
  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet);
  } catch {
    return error("invalid wallet");
  }
  try {
    return json({ lp: await getLpPositions(owner) });
  } catch (err) {
    return error((err as Error).message, 502);
  }
}

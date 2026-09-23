import {
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { USDC_MINT, getConnection } from "@/lib/config";
import { db, error, faucetKeypair, json } from "@/lib/server";

const USDC_AMOUNT = 10_000n * 1_000_000n;
const SOL_TOP_UP = 0.05 * LAMPORTS_PER_SOL;
const SOL_THRESHOLD = 0.02 * LAMPORTS_PER_SOL;
const COOLDOWN_MS = 24 * 60 * 60_000;

function nextClaimAt(claimedAt: string | undefined): number | null {
  if (!claimedAt) return null;
  const at = Date.parse(claimedAt) + COOLDOWN_MS;
  return at > Date.now() ? at : null;
}

/** When the wallet can claim again; null means now. */
export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet") ?? "";
  try {
    new PublicKey(wallet);
  } catch {
    return error("invalid wallet");
  }
  const { data } = await db().from("faucet_claims").select("claimed_at").eq("wallet", wallet).maybeSingle();
  return json({ nextClaimAt: nextClaimAt(data?.claimed_at) });
}

/** Devnet only: test USDC plus a little SOL for fees, once per 24h per wallet. */
export async function POST(req: Request) {
  const { wallet } = (await req.json().catch(() => ({}))) as { wallet?: string };
  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet ?? "");
  } catch {
    return error("invalid wallet");
  }

  const claims = db().from("faucet_claims");
  const { data: last } = await claims.select("claimed_at,claims").eq("wallet", owner.toBase58()).maybeSingle();
  const next = nextClaimAt(last?.claimed_at);
  if (next) {
    const hours = Math.floor((next - Date.now()) / 3_600_000);
    const mins = Math.ceil(((next - Date.now()) % 3_600_000) / 60_000);
    return error(`Already claimed today. Try again in ${hours ? `${hours}h ` : ""}${mins}m`, 429);
  }

  const conn = getConnection();
  const faucet = faucetKeypair();
  const ata = getAssociatedTokenAddressSync(USDC_MINT, owner);
  const ixs = [
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }),
    createAssociatedTokenAccountIdempotentInstruction(faucet.publicKey, ata, owner, USDC_MINT),
    createMintToInstruction(USDC_MINT, ata, faucet.publicKey, USDC_AMOUNT),
  ];
  const sol = await conn.getBalance(owner);
  if (sol < SOL_THRESHOLD) {
    ixs.push(SystemProgram.transfer({ fromPubkey: faucet.publicKey, toPubkey: owner, lamports: SOL_TOP_UP }));
  }

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  const tx = new VersionedTransaction(
    new TransactionMessage({ payerKey: faucet.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(),
  );
  tx.sign([faucet]);
  try {
    const signature = await conn.sendTransaction(tx);
    await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    await claims.upsert({
      wallet: owner.toBase58(),
      claimed_at: new Date().toISOString(),
      claims: (last?.claims ?? 0) + 1,
    });
    return json({ signature, usdc: Number(USDC_AMOUNT) / 1e6, sol: sol < SOL_THRESHOLD ? SOL_TOP_UP / LAMPORTS_PER_SOL : 0 });
  } catch (err) {
    return error(`Faucet failed: ${(err as Error).message}`, 502);
  }
}

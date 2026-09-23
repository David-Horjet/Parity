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
const COOLDOWN_MS = 30 * 60_000;

/** Devnet only: test USDC plus a little SOL for fees. */
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
  if (last && Date.now() - Date.parse(last.claimed_at) < COOLDOWN_MS) {
    const mins = Math.ceil((COOLDOWN_MS - (Date.now() - Date.parse(last.claimed_at))) / 60_000);
    return error(`Faucet cooldown: try again in ${mins} min`, 429);
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

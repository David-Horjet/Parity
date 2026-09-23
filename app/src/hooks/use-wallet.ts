"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { useCallback, useMemo } from "react";
import { getConnection } from "@/lib/config";

/** Anchor/program errors surface as "Error Message: X" in logs; show the human part. */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; logs?: string[] };
  const text = [e?.message ?? String(err), ...(e?.logs ?? [])].join("\n");
  const anchor = text.match(/Error Message: ([^.\n]+)/);
  if (anchor) return anchor[1]!;
  if (/User rejected|rejected the request|cancel/i.test(text)) return "Request cancelled in wallet";
  if (/insufficient (funds|lamports)|0x1\b/i.test(text)) return "Insufficient balance";
  if (/Blockhash not found|block height exceeded/i.test(text)) return "Transaction expired, please retry";
  return (e?.message ?? "Transaction failed").slice(0, 160);
}

export function useParityWallet() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { signTransaction } = useSignTransaction();
  const wallet = wallets[0];
  const publicKey = useMemo(() => (wallet ? new PublicKey(wallet.address) : null), [wallet]);

  const send = useCallback(
    async (ixs: TransactionInstruction[]): Promise<string> => {
      if (!wallet || !publicKey) throw new Error("Connect a wallet first");
      const conn = getConnection();
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [
          ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5_000 }),
          ...ixs,
        ],
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);

      // Simulate first so program errors show up before the wallet prompt.
      const sim = await conn.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
      if (sim.value.err) throw Object.assign(new Error("Simulation failed"), { logs: sim.value.logs ?? [] });

      const { signedTransaction } = await signTransaction({
        transaction: tx.serialize(),
        wallet,
        chain: "solana:devnet",
      });
      const signature = await conn.sendRawTransaction(signedTransaction, { skipPreflight: true, maxRetries: 3 });
      const res = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
      if (res.value.err) throw new Error(`Transaction failed: ${JSON.stringify(res.value.err)}`);
      void fetch("/api/index-tx", { method: "POST", body: JSON.stringify({ signature }) });
      return signature;
    },
    [wallet, publicKey, signTransaction],
  );

  return {
    ready: ready && walletsReady,
    connected: authenticated && !!publicKey,
    authenticated,
    publicKey,
    address: wallet?.address ?? null,
    login,
    logout,
    send,
  };
}

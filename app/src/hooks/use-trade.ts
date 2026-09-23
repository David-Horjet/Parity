"use client";

import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import {
  acceptablePrice,
  closePositionIx,
  depositLiquidityIx,
  getProgram,
  openPositionIx,
  withdrawLiquidityIx,
  type Side,
} from "@parity/sdk";
import { useCallback, useState } from "react";
import { useToast } from "@/components/toast";
import { USDC_MINT, getConnection } from "@/lib/config";
import { usd } from "@/lib/format";
import type { MarketDTO } from "@/lib/types";
import { friendlyError, useParityWallet } from "./use-wallet";

const SLIPPAGE_BPS = 100;

export function useTradeActions() {
  const { publicKey, send } = useParityWallet();
  const toast = useToast();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async (key: string, title: string, build: (owner: PublicKey) => Promise<Parameters<typeof send>[0]>, done: string) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      setPending(key);
      const id = toast.push({ kind: "pending", title });
      try {
        const signature = await send(await build(publicKey));
        toast.update(id, { kind: "success", title: done, signature });
        await Promise.all(
          ["positions", "balances", "markets", "trades", "lp"].map((k) => qc.invalidateQueries({ queryKey: [k] })),
        );
        setTimeout(() => void qc.invalidateQueries({ queryKey: ["trades"] }), 3_000);
        return signature;
      } catch (err) {
        toast.update(id, { kind: "error", title: "Transaction failed", body: friendlyError(err) });
        return null;
      } finally {
        setPending(null);
      }
    },
    [publicKey, send, toast, qc],
  );

  const accounts = (owner: PublicKey, market: MarketDTO) => ({
    owner,
    market: new PublicKey(market.address),
    collateralMint: USDC_MINT,
  });

  const ensureAta = (owner: PublicKey) =>
    createAssociatedTokenAccountIdempotentInstruction(owner, getAssociatedTokenAddressSync(USDC_MINT, owner), owner, USDC_MINT);

  const open = (market: MarketDTO, side: Side, margin: bigint, size: bigint) =>
    run(
      `open:${market.symbol}:${side}`,
      `Opening ${side} ${market.symbol}…`,
      async (owner) => {
        const program = getProgram(getConnection(), owner);
        return [
          ensureAta(owner),
          await openPositionIx(program, {
            ...accounts(owner, market),
            side,
            margin,
            size,
            acceptablePrice: acceptablePrice(side, true, BigInt(market.price), SLIPPAGE_BPS),
          }),
        ];
      },
      `${side === "long" ? "Long" : "Short"} ${market.symbol} opened · ${usd(Number(size) / 1e6)}`,
    );

  const close = (market: MarketDTO, side: Side) =>
    run(
      `close:${market.symbol}:${side}`,
      `Closing ${side} ${market.symbol}…`,
      async (owner) => {
        const program = getProgram(getConnection(), owner);
        return [
          ensureAta(owner),
          await closePositionIx(program, {
            ...accounts(owner, market),
            side,
            acceptablePrice: acceptablePrice(side, false, BigInt(market.price), SLIPPAGE_BPS),
          }),
        ];
      },
      `${market.symbol} ${side} closed`,
    );

  const deposit = (market: MarketDTO, amount: bigint) =>
    run(
      `deposit:${market.symbol}`,
      `Depositing into ${market.symbol} vault…`,
      async (owner) => [await depositLiquidityIx(getProgram(getConnection(), owner), { ...accounts(owner, market), amount })],
      `Deposited ${usd(Number(amount) / 1e6)} into ${market.symbol} vault`,
    );

  const withdraw = (market: MarketDTO, shares: bigint) =>
    run(
      `withdraw:${market.symbol}`,
      `Withdrawing from ${market.symbol} vault…`,
      async (owner) => [
        ensureAta(owner),
        await withdrawLiquidityIx(getProgram(getConnection(), owner), { ...accounts(owner, market), shares }),
      ],
      `Withdrew from ${market.symbol} vault`,
    );

  return { open, close, deposit, withdraw, pending };
}

"use client";

import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { USDC_MINT, getConnection } from "@/lib/config";
import type { Candle, MarketDTO, PositionDTO, TradeDTO } from "@/lib/types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed ${res.status}`);
  return body as T;
}

export function useMarkets() {
  return useQuery({
    queryKey: ["markets"],
    queryFn: () => get<{ markets: MarketDTO[] }>("/api/markets").then((r) => r.markets),
    refetchInterval: 4_000,
  });
}

export function usePositions(address: string | null) {
  return useQuery({
    queryKey: ["positions", address],
    queryFn: () => get<{ positions: PositionDTO[] }>(`/api/positions/${address}`).then((r) => r.positions),
    enabled: !!address,
    refetchInterval: 5_000,
  });
}

export function useTrades(address: string | null) {
  return useQuery({
    queryKey: ["trades", address],
    queryFn: () => get<{ trades: TradeDTO[] }>(`/api/trades/${address}`).then((r) => r.trades),
    enabled: !!address,
    refetchInterval: 10_000,
  });
}

export function useCandles(symbol: string, tf: string) {
  return useQuery({
    queryKey: ["candles", symbol, tf],
    queryFn: () => get<{ candles: Candle[] }>(`/api/markets/${symbol}/history?tf=${tf}`).then((r) => r.candles),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useBalances(address: string | null) {
  return useQuery({
    queryKey: ["balances", address],
    enabled: !!address,
    refetchInterval: 8_000,
    queryFn: async () => {
      const conn = getConnection();
      const owner = new PublicKey(address!);
      const ata = getAssociatedTokenAddressSync(USDC_MINT, owner);
      const [sol, usdc] = await Promise.all([
        conn.getBalance(owner),
        conn.getTokenAccountBalance(ata).then((r) => BigInt(r.value.amount)).catch(() => 0n),
      ]);
      return { sol: sol / 1e9, usdc };
    },
  });
}

export function useLp(address: string | null) {
  return useQuery({
    queryKey: ["lp", address],
    queryFn: () =>
      get<{ lp: import("@/lib/types").LpDTO[] }>(`/api/lp/${address}`).then((r) => r.lp),
    enabled: !!address,
    refetchInterval: 10_000,
  });
}

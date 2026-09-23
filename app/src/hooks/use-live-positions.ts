"use client";

import { useMemo } from "react";
import { livePosition, type LivePosition } from "@/lib/position";
import { useMarkets, usePositions } from "./use-data";

export function useLivePositions(address: string | null) {
  const { data: markets } = useMarkets();
  const { data: positions, isLoading } = usePositions(address);
  const live = useMemo<LivePosition[]>(() => {
    if (!markets || !positions) return [];
    const byAddress = new Map(markets.map((m) => [m.address, m]));
    return positions
      .map((p) => {
        const m = byAddress.get(p.market);
        return m ? livePosition(p, m) : null;
      })
      .filter((p): p is LivePosition => p !== null)
      .sort((a, b) => b.size - a.size);
  }, [markets, positions]);
  return { positions: live, raw: positions ?? [], isLoading };
}

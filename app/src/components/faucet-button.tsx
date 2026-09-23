"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { DropletIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParityWallet } from "@/hooks/use-wallet";
import { useToast } from "./toast";

export function useFaucet() {
  const { address } = useParityWallet();
  const toast = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const claim = async () => {
    if (!address || loading) return;
    setLoading(true);
    const id = toast.push({ kind: "pending", title: "Requesting test USDC…" });
    try {
      const res = await fetch("/api/faucet", { method: "POST", body: JSON.stringify({ wallet: address }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      toast.update(id, {
        kind: "success",
        title: `Received ${body.usdc.toLocaleString()} test USDC`,
        body: body.sol ? `Plus ${body.sol} SOL for fees` : undefined,
        signature: body.signature,
      });
      await qc.invalidateQueries({ queryKey: ["balances"] });
    } catch (err) {
      toast.update(id, { kind: "error", title: "Faucet failed", body: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return { claim, loading, enabled: !!address };
}

export function FaucetButton() {
  const { claim, loading, enabled } = useFaucet();
  if (!enabled) return null;
  return (
    <button
      onClick={claim}
      disabled={loading}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-60"
      title="Get devnet test USDC"
    >
      <HugeiconsIcon icon={loading ? Loading03Icon : DropletIcon} size={16} className={loading ? "animate-spin" : ""} />
      <span className="hidden sm:inline">Faucet</span>
    </button>
  );
}

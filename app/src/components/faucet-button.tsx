"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { DropletIcon, Loading03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParityWallet } from "@/hooks/use-wallet";
import { useToast } from "./toast";

function untilLabel(ms: number) {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.ceil((ms % 3_600_000) / 60_000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function useFaucet() {
  const { connected, address } = useParityWallet();
  const toast = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { data: nextClaimAt, isFetched } = useQuery({
    queryKey: ["faucet", address],
    enabled: !!address,
    queryFn: async () => {
      const res = await fetch(`/api/faucet?wallet=${address}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      return body.nextClaimAt as number | null;
    },
  });

  // Tick so the countdown and availability update without a refetch.
  useEffect(() => {
    if (!nextClaimAt) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [nextClaimAt]);

  const cooldown = nextClaimAt && nextClaimAt > now ? nextClaimAt - now : 0;
  const available = connected && isFetched && cooldown === 0;

  const claim = async () => {
    if (!address || loading || !available) return;
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
      setNow(Date.now());
      await qc.invalidateQueries({ queryKey: ["faucet", address] });
      setLoading(false);
    }
  };

  return { claim, loading, connected, available, cooldownLabel: cooldown ? untilLabel(cooldown) : null };
}

export function FaucetButton() {
  const { claim, loading, connected, available, cooldownLabel } = useFaucet();
  if (!connected) return null;
  return (
    <button
      onClick={claim}
      disabled={loading || !available}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white/3 px-3 text-sm text-muted transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:text-muted"
      title={cooldownLabel ? `Claimed today. Next claim in ${cooldownLabel}` : "Get devnet test USDC (once per day)"}
    >
      <HugeiconsIcon
        icon={loading ? Loading03Icon : cooldownLabel ? Tick02Icon : DropletIcon}
        size={16}
        className={loading ? "animate-spin" : ""}
      />
      <span className="num hidden sm:inline">{cooldownLabel ? cooldownLabel : "Faucet"}</span>
    </button>
  );
}

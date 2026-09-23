"use client";

import { HistoryTable, PositionsTable } from "@/components/positions-panel";
import { useBalances } from "@/hooks/use-data";
import { useLivePositions } from "@/hooks/use-live-positions";
import { useParityWallet } from "@/hooks/use-wallet";
import { fromRaw, signedUsd, usd } from "@/lib/format";

function Card({ label, value, tone }: { label: string; value: string; tone?: "long" | "short" }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/70 p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num mt-1 text-2xl ${tone === "long" ? "text-long" : tone === "short" ? "text-short" : ""}`}>{value}</p>
    </div>
  );
}

export default function PortfolioPage() {
  const { connected, address, login } = useParityWallet();
  const { data: balances } = useBalances(address);
  const { positions } = useLivePositions(address);

  if (!connected) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-24 text-center">
        <p className="font-display text-3xl font-bold">Your portfolio</p>
        <p className="mt-2 text-sm text-muted">Connect a wallet to see balances, positions and history.</p>
        <button onClick={login} className="mt-6 h-11 rounded-xl bg-accent px-6 text-sm font-bold text-bg">
          Connect wallet
        </button>
      </main>
    );
  }

  const balance = balances ? fromRaw(balances.usdc) : 0;
  const used = positions.reduce((s, p) => s + p.margin, 0);
  const upnl = positions.reduce((s, p) => s + p.pnl - p.funding, 0);
  const equity = balance + used + upnl;

  return (
    <main className="mx-auto max-w-[1600px] space-y-3 p-3">
      <h1 className="px-1 pt-2 font-display text-3xl font-bold">Portfolio</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Account value" value={usd(equity)} />
        <Card label="Available (wallet USDC)" value={usd(balance)} />
        <Card label="Used margin" value={usd(used)} />
        <Card label="Unrealized PnL" value={signedUsd(upnl)} tone={upnl >= 0 ? "long" : "short"} />
      </div>
      <section className="overflow-hidden rounded-2xl border border-line bg-panel/70">
        <p className="border-b border-line px-4 py-3 text-sm font-medium">Open positions ({positions.length})</p>
        <PositionsTable positions={positions} />
      </section>
      <section className="overflow-hidden rounded-2xl border border-line bg-panel/70">
        <p className="border-b border-line px-4 py-3 text-sm font-medium">Trade history</p>
        <HistoryTable address={address} />
      </section>
    </main>
  );
}

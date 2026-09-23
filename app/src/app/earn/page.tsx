"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { TokenLogo } from "@/components/token-logo";
import { useBalances, useLp, useMarkets } from "@/hooks/use-data";
import { useTradeActions } from "@/hooks/use-trade";
import { useParityWallet } from "@/hooks/use-wallet";
import { compact, fromRaw, pct, usd } from "@/lib/format";
import { marketNav } from "@/lib/position";
import type { MarketDTO } from "@/lib/types";

function VaultRow({ market, shares, usdc }: { market: MarketDTO; shares: bigint; usdc: bigint }) {
  const { connected, login } = useParityWallet();
  const { deposit, withdraw, pending } = useTradeActions();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");

  const nav = marketNav(market);
  const totalShares = BigInt(market.lpShares);
  const sharePrice = totalShares > 0n ? nav / (Number(totalShares) / 1e6) : 1;
  const mine = (Number(shares) / 1e6) * sharePrice;
  const oi = fromRaw(market.longSize) + fromRaw(market.shortSize);
  const cap = (nav * market.config.maxOiToLiquidityBps) / 10_000;
  const utilization = cap > 0 ? Math.max(fromRaw(market.longSize), fromRaw(market.shortSize)) / cap : 0;
  const raw = BigInt(Math.floor((Number(amount) || 0) * 1e6));
  const busy = pending?.endsWith(market.symbol);

  const submit = async () => {
    if (!connected) return login();
    if (raw <= 0n) return;
    if (mode === "deposit") {
      if (await deposit(market, raw)) setAmount("");
    } else {
      const sh = sharePrice > 0 ? BigInt(Math.floor((Number(raw) / sharePrice))) : 0n;
      if (await withdraw(market, sh > shares ? shares : sh)) setAmount("");
    }
  };

  return (
    <div className="rounded-2xl panel">
      <button onClick={() => setOpen((o) => !o)} className="grid w-full grid-cols-2 items-center gap-4 p-4 text-left sm:grid-cols-6">
        <span className="col-span-2 flex items-center gap-3 sm:col-span-2">
          <TokenLogo src={market.image} symbol={market.symbol} size={30} />
          <span>
            <span className="block font-medium">{market.symbol} vault</span>
            <span className="block text-xs text-muted">Counterparty to {market.symbol}-PERP traders</span>
          </span>
        </span>
        <span>
          <span className="block text-xs text-dim">Liquidity</span>
          <span className="num">{compact(nav)}</span>
        </span>
        <span>
          <span className="block text-xs text-dim">Open interest</span>
          <span className="num">{compact(oi)}</span>
        </span>
        <span>
          <span className="block text-xs text-dim">Utilization</span>
          <span className="num">{pct(utilization, 1).replace("+", "")}</span>
        </span>
        <span>
          <span className="block text-xs text-dim">Your deposit</span>
          <span className="num">{shares > 0n ? usd(mine) : "–"}</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-4 border-t border-line p-4 md:grid-cols-[1fr_320px]">
              <div className="space-y-2 text-sm text-muted">
                <p>
                  LPs take the other side of every {market.symbol} trade. The vault earns trading fees ({market.config.tradingFeeBps / 100}% on open and
                  close), funding from the crowded side, and trader losses. It pays out trader profits.
                </p>
                <p>
                  Open interest per side is capped at {market.config.maxOiToLiquidityBps / 100}% of vault liquidity. Withdrawals that would break that cap are blocked.
                </p>
                <p className="num text-xs">Share price {usd(sharePrice, 4)}</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 rounded-lg bg-panel-2 p-1 text-sm">
                  {(["deposit", "withdraw"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`rounded-md py-1.5 capitalize ${mode === m ? "bg-raise text-ink" : "text-muted"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 focus-within:border-line-strong py-2.5">
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="num w-full bg-transparent outline-none placeholder:text-dim"
                  />
                  <button
                    onClick={() => setAmount(((mode === "deposit" ? fromRaw(usdc) : mine) || 0).toFixed(2))}
                    className="text-xs text-accent"
                  >
                    MAX
                  </button>
                </label>
                <button
                  onClick={submit}
                  disabled={busy}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-bg disabled:opacity-60"
                >
                  {busy && <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />}
                  {!connected ? "Connect wallet" : mode === "deposit" ? "Deposit USDC" : "Withdraw USDC"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EarnPage() {
  const { data: markets } = useMarkets();
  const { address } = useParityWallet();
  const { data: lp } = useLp(address);
  const { data: balances } = useBalances(address);
  const total = (markets ?? []).reduce((s, m) => s + marketNav(m), 0);

  return (
    <main className="mx-auto max-w-5xl space-y-3 px-3 pb-20 pt-6">
      <div className="px-1">
        <h1 className="text-3xl font-medium tracking-tight">Earn</h1>
        <p className="mt-1 text-sm text-muted">
          Provide USDC liquidity to a market vault and earn fees and funding from its traders. {compact(total)} total liquidity.
        </p>
      </div>
      {(markets ?? []).map((m) => (
        <VaultRow
          key={m.symbol}
          market={m}
          shares={BigInt(lp?.find((x) => x.symbol === m.symbol)?.shares ?? 0)}
          usdc={balances?.usdc ?? 0n}
        />
      ))}
    </main>
  );
}

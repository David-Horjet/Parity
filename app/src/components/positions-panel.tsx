"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useState } from "react";
import { useTrades } from "@/hooks/use-data";
import { useTradeActions } from "@/hooks/use-trade";
import { explorerTx } from "@/lib/config";
import { pct, price, signedUsd, usd } from "@/lib/format";
import { cardFromPosition, cardFromTrade } from "@/lib/pnl-card";
import type { LivePosition } from "@/lib/position";
import { PnlShareButton } from "./pnl-share";
import { TokenLogo } from "./token-logo";

const th = "px-3 py-2 text-left text-[11px] font-normal uppercase tracking-wider text-dim whitespace-nowrap";
const td = "px-3 py-2.5 whitespace-nowrap num";

export function PositionsTable({ positions, compact = false }: { positions: LivePosition[]; compact?: boolean }) {
  const { close, pending } = useTradeActions();
  if (positions.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted">No open positions</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Market</th>
            <th className={th}>Size</th>
            <th className={th}>Entry</th>
            <th className={th}>Mark</th>
            <th className={th}>Liq. price</th>
            <th className={th}>Margin</th>
            <th className={th}>PnL (ROE)</th>
            {!compact && <th className={th}>Funding</th>}
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {positions.map((p) => {
              const key = `close:${p.market.symbol}:${p.position.side}`;
              const net = p.pnl - p.funding;
              return (
                <motion.tr
                  key={p.position.address}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className={td}>
                    <Link href={`/trade/${p.market.symbol}`} className="flex items-center gap-2">
                      <TokenLogo src={p.market.image} symbol={p.market.symbol} size={22} />
                      <span className="font-medium">{p.market.symbol}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium uppercase ${p.position.side === "long" ? "bg-long/15 text-long" : "bg-short/15 text-short"}`}
                      >
                        {p.position.side} {p.leverage.toFixed(1)}x
                      </span>
                    </Link>
                  </td>
                  <td className={td}>{usd(p.size)}</td>
                  <td className={td}>{price(p.entry)}</td>
                  <td className={td}>{price(p.mark)}</td>
                  <td className={`${td} text-warn`}>{price(p.liquidation)}</td>
                  <td className={td}>{usd(p.margin)}</td>
                  <td className={`${td} ${net >= 0 ? "text-long" : "text-short"}`}>
                    {signedUsd(net)} <span className="text-xs opacity-80">({pct(p.roe)})</span>
                  </td>
                  {!compact && <td className={`${td} text-muted`}>{signedUsd(-p.funding)}</td>}
                  <td className={`${td} text-right`}>
                    <PnlShareButton card={cardFromPosition(p)} className="mr-3 align-middle" />
                    <button
                      onClick={() => close(p.market, p.position.side)}
                      disabled={!!pending}
                      className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1 text-xs transition hover:border-line-strong hover:bg-raise disabled:opacity-50"
                    >
                      {pending === key && <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />}
                      Close
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

export function HistoryTable({ address }: { address: string | null }) {
  const { data: trades, isLoading } = useTrades(address);
  if (!address) return <p className="px-4 py-10 text-center text-sm text-muted">Connect a wallet to see history</p>;
  if (isLoading) return <p className="px-4 py-10 text-center text-sm text-muted">Loading…</p>;
  if (!trades?.length) return <p className="px-4 py-10 text-center text-sm text-muted">No trades yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className={th}>Time</th>
            <th className={th}>Market</th>
            <th className={th}>Action</th>
            <th className={th}>Size</th>
            <th className={th}>Price</th>
            <th className={th}>Leverage</th>
            <th className={th}>PnL</th>
            <th className={th}>Fee</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => (
            <tr key={`${t.signature}-${t.kind}`} className="border-b border-line/60 last:border-0">
              <td className={`${td} text-muted`}>{new Date(t.ts).toLocaleString()}</td>
              <td className={td}>{t.symbol}</td>
              <td className={td}>
                <span className={t.side === "long" ? "text-long" : "text-short"}>
                  {t.kind === "open" ? "Open" : t.kind === "close" ? "Close" : "Liquidated"} {t.side}
                </span>
              </td>
              <td className={td}>{usd(t.size)}</td>
              <td className={td}>
                {t.entry_price && t.kind !== "open" ? `${price(t.entry_price)} → ${price(t.price)}` : price(t.price)}
              </td>
              <td className={td}>{t.margin ? `${(t.size / t.margin).toFixed(1)}x` : "–"}</td>
              <td className={`${td} ${t.pnl === null ? "text-dim" : t.pnl >= 0 ? "text-long" : "text-short"}`}>
                {t.pnl === null ? "–" : signedUsd(t.pnl - (t.funding ?? 0))}
              </td>
              <td className={`${td} text-muted`}>{t.fee !== null ? usd(t.fee) : "–"}</td>
              <td className={td}>
                <div className="flex items-center gap-3">
                  <PnlShareButton card={cardFromTrade(t)} />
                  <a href={explorerTx(t.signature)} target="_blank" rel="noreferrer" className="text-dim hover:text-accent">
                    <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} />
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PositionsTabs({ positions, address }: { positions: LivePosition[]; address: string | null }) {
  const [tab, setTab] = useState<"positions" | "history">("positions");
  return (
    <div>
      <div className="flex gap-1 border-b border-line px-3 pt-2">
        {(
          [
            ["positions", `Positions${positions.length ? ` (${positions.length})` : ""}`],
            ["history", "History"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative px-3 pb-2 pt-1 text-sm transition ${tab === k ? "text-ink" : "text-muted hover:text-ink"}`}
          >
            {label}
            {tab === k && <motion.span layoutId="pos-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-accent" />}
          </button>
        ))}
      </div>
      {tab === "positions" ? <PositionsTable positions={positions} /> : <HistoryTable address={address} />}
    </div>
  );
}

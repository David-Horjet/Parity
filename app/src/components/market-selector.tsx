"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MarketDTO } from "@/lib/types";
import { compact, fromRaw, pct, price } from "@/lib/format";
import { TokenLogo } from "./token-logo";

export function MarketSelector({ markets, current }: { markets: MarketDTO[]; current?: MarketDTO }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = markets.filter(
    (m) => m.symbol.includes(q.toUpperCase()) || m.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-raise"
      >
        {current && <TokenLogo src={current.image} symbol={current.symbol} size={32} />}
        <div className="text-left">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">{current?.symbol ?? "…"}-PERP</span>
            <span className="rounded bg-raise px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {current?.config.maxLeverage ?? 5}x
            </span>
          </div>
          <span className="text-xs text-muted">{current?.name ?? "Loading"}</span>
        </div>
        <HugeiconsIcon icon={ArrowDown01Icon} size={16} className={`text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 z-30 mt-2 w-[min(440px,calc(100vw-2rem))] rounded-xl popover p-2"
          >
            <label className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-bg/40 px-3 py-2">
              <HugeiconsIcon icon={Search01Icon} size={16} className="text-dim" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search companies"
                className="w-full bg-transparent text-sm outline-none placeholder:text-dim"
              />
            </label>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-2 pb-1 text-[11px] uppercase tracking-wider text-dim">
              <span>Market</span>
              <span className="text-right">Price</span>
              <span className="w-24 text-right">Valuation</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filtered.map((m) => (
                <Link
                  key={m.symbol}
                  href={`/trade/${m.symbol}`}
                  onClick={() => setOpen(false)}
                  className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-lg px-2 py-2 transition hover:bg-raise ${m.symbol === current?.symbol ? "bg-raise/60" : ""}`}
                >
                  <span className="flex items-center gap-2.5">
                    <TokenLogo src={m.image} symbol={m.symbol} size={24} />
                    <span>
                      <span className="block text-sm font-medium">{m.symbol}</span>
                      <span className="block text-xs text-muted">{m.name}</span>
                    </span>
                  </span>
                  <span className="num text-right text-sm">
                    {price(fromRaw(m.price))}
                    {m.change24h !== null && (
                      <span className={`block text-xs ${m.change24h >= 0 ? "text-long" : "text-short"}`}>
                        {pct(m.change24h / 100)}
                      </span>
                    )}
                  </span>
                  <span className="num w-24 text-right text-sm text-muted">
                    {m.impliedValuation ? compact(m.impliedValuation) : "–"}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

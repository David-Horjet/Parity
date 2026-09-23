"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { MarketDTO } from "@/lib/types";
import { compact, fromRaw, pct, price } from "@/lib/format";
import { marketFundingRate } from "@/lib/position";

function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="shrink-0" title={hint}>
      <p className="text-[11px] text-dim">{label}</p>
      <div className="num text-sm">{children}</div>
    </div>
  );
}

/** Flashes green/red when the price ticks. */
export function LivePrice({ value, className = "" }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (value !== prev.current) {
      setDir(value > prev.current ? "up" : "down");
      prev.current = value;
      const t = setTimeout(() => setDir(null), 700);
      return () => clearTimeout(t);
    }
  }, [value]);
  return (
    <span
      className={`num transition-colors duration-500 ${dir === "up" ? "text-long" : dir === "down" ? "text-short" : ""} ${className}`}
    >
      {price(value)}
    </span>
  );
}

export function MarketStats({ market }: { market: MarketDTO }) {
  const index = fromRaw(market.price);
  const funding = marketFundingRate(market);
  const premium = market.markPrice ? index / market.markPrice - 1 : null;
  const age = Math.max(0, Math.floor(Date.now() / 1000) - market.priceUpdatedAt);
  return (
    <div className="flex items-center gap-6 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
      <div className="shrink-0">
        <LivePrice value={index} className="text-xl font-medium" />
        <AnimatePresence>
          {age > market.config.maxPriceAgeSecs && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] text-warn">
              Price stale
            </motion.p>
          )}
        </AnimatePresence>
      </div>
      <Stat label="24h change">
        {market.change24h === null ? (
          "–"
        ) : (
          <span className={market.change24h >= 0 ? "text-long" : "text-short"}>{pct(market.change24h / 100)}</span>
        )}
      </Stat>
      <Stat label="SPV mark" hint="PreStocks mark price for the underlying SPV">
        {market.markPrice ? price(market.markPrice) : "–"}
        {premium !== null && (
          <span className={`ml-1 text-xs ${premium >= 0 ? "text-long" : "text-short"}`}>{pct(premium, 1)}</span>
        )}
      </Stat>
      <Stat label="Implied valuation" hint="Company valuation implied by the perp price">
        {market.impliedValuation ? compact(market.impliedValuation) : "–"}
      </Stat>
      <Stat label="Open interest" hint="Long / short notional">
        <span className="text-long">{compact(fromRaw(market.longSize))}</span>
        <span className="text-dim"> / </span>
        <span className="text-short">{compact(fromRaw(market.shortSize))}</span>
      </Stat>
      <Stat label="Funding / 1h" hint="Positive: longs pay shorts">
        <span className={funding > 0 ? "text-short" : funding < 0 ? "text-long" : "text-muted"}>
          {pct(funding, 4)}
        </span>
      </Stat>
      <Stat label="Vault liquidity">{compact(fromRaw(market.vaultBalance))}</Stat>
    </div>
  );
}

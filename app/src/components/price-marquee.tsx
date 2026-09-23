"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDownRight01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import type { MarketDTO } from "@/lib/types";
import { pct } from "@/lib/format";
import { TokenLogo } from "./token-logo";

const MIN_ITEMS = 12;
const SECONDS_PER_ITEM = 3.5;

/** Endless ticker: logo, symbol, 24h change. Pauses on hover. */
export function PriceMarquee({ markets }: { markets?: MarketDTO[] }) {
  if (!markets?.length) {
    return (
      <div className="marquee-mask flex gap-3 overflow-hidden">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="h-10 w-40 shrink-0 animate-pulse rounded-full bg-white/5" />
        ))}
      </div>
    );
  }

  // One half must be wider than the viewport, so repeat short lists; the track holds two halves and slides by -50%.
  const half = Array.from({ length: Math.ceil(MIN_ITEMS / markets.length) }, () => markets).flat();
  const track = [...half, ...half];

  return (
    <div className="marquee-mask group overflow-hidden">
      <div
        className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": `${half.length * SECONDS_PER_ITEM}s` } as React.CSSProperties}
      >
        {track.map((m, i) => {
          const up = (m.change24h ?? 0) >= 0;
          const clone = i >= markets.length;
          return (
            <Link
              key={`${m.symbol}-${i}`}
              href={`/trade/${m.symbol}`}
              aria-hidden={clone || undefined}
              tabIndex={clone ? -1 : undefined}
              className="mr-3 flex shrink-0 items-center gap-2.5 rounded-full border border-white/8 bg-white/4 py-1.5 pl-1.5 pr-4 transition hover:border-white/20 hover:bg-white/8"
            >
              <TokenLogo src={m.image} symbol={m.symbol} size={26} />
              <span className="text-sm font-medium">{m.symbol}</span>
              {m.change24h === null ? (
                <span className="num text-sm text-dim">–</span>
              ) : (
                <span className={`num flex items-center gap-0.5 text-sm ${up ? "text-long" : "text-short"}`}>
                  <HugeiconsIcon icon={up ? ArrowUpRight01Icon : ArrowDownRight01Icon} size={14} />
                  {pct(m.change24h / 100)}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

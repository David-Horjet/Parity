"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { TokenLogo } from "@/components/token-logo";
import { useMarkets } from "@/hooks/use-data";
import { compact, fromRaw, pct, price } from "@/lib/format";

const FEATURES = [
  { title: "Long or short", body: "Short the private companies everyone is long. Or lever up on the ones you believe in." },
  { title: "Up to 5x, isolated", body: "USDC margin, a liquidation price you see before you sign, one position per side." },
  { title: "Priced by the market", body: "5-min TWAP of the real PreStocks tokens trading on Solana, checked against the SPV mark." },
  { title: "24/7 on Solana", body: "No brokerage hours or accreditation forms. Sub-second fills at fractions of a cent." },
];

export default function Home() {
  const { data: markets } = useMarkets();
  return (
    <main className="mx-auto max-w-6xl px-4 pb-24">
      <section className="pt-16 text-center sm:pt-24">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-long" /> The derivatives layer for PreStocks
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mx-auto mt-6 max-w-3xl font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Trade private companies with <span className="text-accent">leverage.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg"
        >
          Perpetual futures on OpenAI, Anthropic, Anduril and more, 24/7 on Solana.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-8 flex justify-center gap-3"
        >
          <Link
            href="/trade/OPENAI"
            className="group inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-bold text-bg transition hover:brightness-110"
          >
            Start trading
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/earn"
            className="inline-flex h-12 items-center rounded-xl border border-line px-6 text-sm text-muted transition hover:border-line-strong hover:text-ink"
          >
            Provide liquidity
          </Link>
        </motion.div>
      </section>

      <section className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(markets ?? Array.from({ length: 4 }, () => null)).slice(0, 8).map((m, i) =>
          m ? (
            <motion.div key={m.symbol} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}>
              <Link
                href={`/trade/${m.symbol}`}
                className="block rounded-2xl border border-line bg-panel/70 p-4 transition hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="flex items-center gap-2.5">
                  <TokenLogo src={m.image} symbol={m.symbol} size={30} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted">{m.symbol}-PERP</p>
                  </div>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="num text-lg">{price(fromRaw(m.price))}</p>
                    <p className="num text-xs text-muted">{m.impliedValuation ? `${compact(m.impliedValuation)} valuation` : ""}</p>
                  </div>
                  {m.change24h !== null && (
                    <span className={`num text-sm ${m.change24h >= 0 ? "text-long" : "text-short"}`}>{pct(m.change24h / 100)}</span>
                  )}
                </div>
              </Link>
            </motion.div>
          ) : (
            <div key={i} className="h-[118px] animate-pulse rounded-2xl bg-panel" />
          ),
        )}
      </section>

      <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title}>
            <p className="font-display text-xl font-semibold">{f.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </section>

      <p className="mt-16 text-center text-xs text-dim">
        Running on Solana devnet with test USDC. Markets and prices come from{" "}
        <a href="https://prestocks.com" className="underline hover:text-muted" target="_blank" rel="noreferrer">
          PreStocks
        </a>
        . Not investment advice.
      </p>
    </main>
  );
}

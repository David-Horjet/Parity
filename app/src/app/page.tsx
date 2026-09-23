"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Image from "next/image";
import Link from "next/link";
import { FeatureTimeline } from "@/components/feature-timeline";
import { PriceMarquee } from "@/components/price-marquee";
import { SiteFooter } from "@/components/site-footer";
import { useMarkets } from "@/hooks/use-data";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE_OUT },
});

function PrimaryCta() {
  return (
    <Link
      href="/trade/OPENAI"
      className="group inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-6 text-sm font-bold text-bg shadow-[0_8px_30px_-8px_rgb(255_255_255/0.35)] transition hover:bg-pearl"
    >
      Start trading
      <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function SecondaryCta() {
  return (
    <Link href="/earn" className="glass inline-flex h-12 items-center rounded-xl px-6 text-sm text-pearl transition hover:text-ink">
      Provide liquidity
    </Link>
  );
}

export default function Home() {
  const { data: markets } = useMarkets();
  return (
    <main>
      {/* Pulled up under the transparent header (h-14, plus the h-9 mobile nav row) so the header sits on the hero. */}
      <section className="hero-gradient grain relative -mt-23 overflow-hidden pt-23 sm:-mt-14 sm:pt-14">
        <div className="relative z-10 mx-auto max-w-6xl px-4 pt-16 text-center sm:pt-28">
          {/* <motion.p
            {...rise(0)}
            className="glass mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-pearl"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-long shadow-[0_0_8px_var(--color-long)]" /> The derivatives layer for PreStocks
          </motion.p> */}
          <motion.h1
            {...rise(0.05)}
            className="mx-auto mt-3 max-w-4xl text-5xl font-medium leading-[1.05] tracking-[-0.035em] sm:text-7xl"
          >
            Trade private companies with{" "}
            <span className="bg-linear-to-r from-ink via-pearl to-[#9aa6ff] bg-clip-text pr-1 font-display font-medium italic text-transparent">
              leverage.
            </span>
          </motion.h1>
          <motion.p {...rise(0.1)} className="mx-auto mt-6 max-w-xl text-base font-light text-muted sm:text-lg">
            Perpetual futures on OpenAI, Anthropic, Anduril and more, 24/7 on Solana.
          </motion.p>
          <motion.div {...rise(0.15)} className="mt-9 flex flex-wrap justify-center gap-3">
            <PrimaryCta />
            <SecondaryCta />
          </motion.div>
        </div>

        <motion.div {...rise(0.25)} className="relative z-10 mt-16 sm:mt-24">
          <PriceMarquee markets={markets} />
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-bg" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-dim">How it works</p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">
            Everything a perp trader expects, for companies that aren&apos;t public yet.
          </h2>
        </div>
        <FeatureTimeline />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
          className="glass grain relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_120%,rgb(79_99_255/0.35),transparent_70%)]" />
          <Image
            src="/images/logos/parity-white-logo-nobg.png"
            alt=""
            width={500}
            height={500}
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 w-72 opacity-[0.05] sm:w-96"
          />
          <div className="relative z-10">
            <h2 className="mx-auto max-w-2xl text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
              Get exposure before the <span className="font-display italic">listing.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted sm:text-base">
              Connect a wallet, claim test USDC from the faucet and open your first position in under a minute.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <PrimaryCta />
              <SecondaryCta />
            </div>
            <p className="mt-10 text-xs text-dim">
              Running on Solana devnet with test USDC. Markets and prices come from{" "}
              <a href="https://prestocks.com" className="underline hover:text-muted" target="_blank" rel="noreferrer">
                PreStocks
              </a>
              . Not investment advice.
            </p>
          </div>
        </motion.div>
      </section>

      <SiteFooter />
    </main>
  );
}

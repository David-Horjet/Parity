"use client";

import { motion, useScroll, useSpring } from "framer-motion";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ChartIncreaseIcon,
  ChartLineData01Icon,
  Coins01Icon,
  DashboardSpeed02Icon,
  FlashIcon,
} from "@hugeicons/core-free-icons";
import { useRef } from "react";

const STEPS: { icon: IconSvgElement; title: string; body: string }[] = [
  {
    icon: ChartIncreaseIcon,
    title: "Long or short",
    body: "Short the private companies everyone is long. Or lever up on the ones you believe in.",
  },
  {
    icon: DashboardSpeed02Icon,
    title: "Up to 5x, isolated",
    body: "USDC margin, a liquidation price you see before you sign, one position per side.",
  },
  {
    icon: ChartLineData01Icon,
    title: "Priced by the market",
    body: "5-min TWAP of the real PreStocks tokens trading on Solana, checked against the SPV mark.",
  },
  {
    icon: FlashIcon,
    title: "24/7 on Solana",
    body: "No brokerage hours or accreditation forms. Sub-second fills at fractions of a cent.",
  },
  {
    icon: Coins01Icon,
    title: "Earn as the house",
    body: "Deposit USDC into a market vault and take the other side. Fees, funding and trader losses flow to LPs.",
  },
];

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Vertical timeline whose rail fills as the section scrolls past; steps fade up on entry. */
export function FeatureTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <div ref={ref} className="relative">
      <div className="absolute inset-y-8 left-8 w-px -translate-x-1/2 bg-white/8 lg:left-1/2" />
      <motion.div
        style={{ scaleY: progress }}
        className="absolute inset-y-8 left-8 w-px origin-top -translate-x-1/2 bg-linear-to-b from-glow via-pearl to-long shadow-[0_0_12px_rgb(79_99_255/0.6)] lg:left-1/2"
      />
      <ol className="space-y-12 lg:space-y-16">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[64px_1fr] items-center gap-x-5 lg:grid-cols-[1fr_96px_1fr] lg:gap-x-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
              className="col-start-1 row-start-1 justify-self-center rounded-2xl bg-bg lg:col-start-2"
            >
              <div className="glass flex h-16 w-16 items-center justify-center rounded-2xl text-ink lg:h-20 lg:w-20">
                <HugeiconsIcon icon={s.icon} size={34} strokeWidth={1.5} />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.9, ease: EASE_OUT }}
              className={`glass col-start-2 row-start-1 rounded-2xl p-5 sm:p-6 ${i % 2 ? "lg:col-start-3" : "lg:col-start-1 lg:text-right"}`}
            >
              <p className="num text-xs tracking-widest text-dim">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-2 text-xl font-medium tracking-tight">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </motion.div>
          </li>
        ))}
      </ol>
    </div>
  );
}

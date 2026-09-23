"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Logo } from "./logo";
import { WalletButton } from "./wallet-button";
import { FaucetButton } from "./faucet-button";

const NAV = [
  { href: "/trade/OPENAI", match: "/trade", label: "Trade" },
  { href: "/portfolio", match: "/portfolio", label: "Portfolio" },
  { href: "/earn", match: "/earn", label: "Earn" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-transparent backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
        <Logo />
        <nav className="ml-1 hidden items-center gap-1 sm:flex">
          {NAV.map((n) => {
            const active = path.startsWith(n.match);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"}`}
              >
                {active && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-white/6" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                )}
                <span className="relative">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <span className="ml-1 hidden rounded-full bg-warn/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warn md:inline">
          Devnet
        </span>
        <div className="ml-auto flex items-center gap-2">
          <FaucetButton />
          <WalletButton />
        </div>
      </div>
      <nav className="flex sm:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex-1 py-2 text-center text-sm ${path.startsWith(n.match) ? "text-ink" : "text-muted"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

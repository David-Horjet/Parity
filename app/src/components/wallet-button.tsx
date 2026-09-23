"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Copy01Icon, Logout01Icon, Wallet01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useRef, useState } from "react";
import { useParityWallet } from "@/hooks/use-wallet";
import { useBalances } from "@/hooks/use-data";
import { explorerAccount } from "@/lib/config";
import { fromRaw, short, usd } from "@/lib/format";

export function WalletButton() {
  const { ready, connected, authenticated, address, login, logout } = useParityWallet();
  const { data: balances } = useBalances(address);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!ready) return <div className="h-9 w-32 animate-pulse rounded-lg bg-raise" />;

  if (!connected || !address) {
    return (
      <button
        onClick={login}
        className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-bg transition hover:brightness-110"
      >
        <HugeiconsIcon icon={Wallet01Icon} size={16} />
        {authenticated ? "Loading wallet…" : "Connect"}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm transition hover:border-line-strong"
      >
        <span className="num hidden text-muted sm:inline">{balances ? usd(fromRaw(balances.usdc)) : "…"}</span>
        <span className="h-2 w-2 rounded-full bg-long" />
        <span className="font-medium">{short(address)}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-2 w-64 rounded-xl border border-line bg-panel-2 p-2 shadow-2xl"
          >
            <div className="px-2 py-2">
              <p className="text-xs text-muted">Balance</p>
              <p className="num text-lg font-medium">{balances ? usd(fromRaw(balances.usdc)) : "…"} <span className="text-xs text-muted">USDC</span></p>
              <p className="num text-xs text-muted">{balances ? balances.sol.toFixed(4) : "…"} SOL</p>
            </div>
            <div className="my-1 h-px bg-line" />
            <button
              onClick={() => navigator.clipboard.writeText(address)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted hover:bg-raise hover:text-ink"
            >
              <HugeiconsIcon icon={Copy01Icon} size={16} /> Copy address
            </button>
            <a
              href={explorerAccount(address)}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted hover:bg-raise hover:text-ink"
            >
              <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} /> View on explorer
            </a>
            <button
              onClick={() => {
                setOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-short hover:bg-raise"
            >
              <HugeiconsIcon icon={Logout01Icon} size={16} /> Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

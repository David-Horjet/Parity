"use client";

import { AnimatePresence, motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Copy01Icon,
  DropletIcon,
  Loading03Icon,
  Logout01Icon,
  PieChartIcon,
  Tick02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useParityWallet } from "@/hooks/use-wallet";
import { useBalances } from "@/hooks/use-data";
import { explorerAccount } from "@/lib/config";
import { fromRaw, short, usd } from "@/lib/format";
import { useFaucet } from "./faucet-button";

/** Parity's smiley avatar: a glossy brand-blue orb with a grin, tinted per wallet so accounts stay recognisable. */
export function Smiley({ address, size = 28 }: { address: string; size?: number }) {
  const id = useId();
  let h = 0;
  for (const c of address) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // Keep within the brand's blue–violet band.
  const hue = 215 + (h % 50);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0" aria-hidden>
      <defs>
        <radialGradient id={`${id}-fill`} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor={`hsl(${hue} 100% 86%)`} />
          <stop offset="55%" stopColor={`hsl(${hue} 90% 68%)`} />
          <stop offset="100%" stopColor={`hsl(${hue + 12} 75% 48%)`} />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15.5" fill={`url(#${id}-fill)`} />
      <circle cx="16" cy="16" r="15" fill="none" stroke="white" strokeOpacity="0.35" />
      <ellipse cx="10.5" cy="7.5" rx="4.5" ry="2.4" fill="white" fillOpacity="0.45" transform="rotate(-25 10.5 7.5)" />
      <circle cx="8.2" cy="19" r="2.3" fill="#ff8fb0" fillOpacity="0.45" />
      <circle cx="23.8" cy="19" r="2.3" fill="#ff8fb0" fillOpacity="0.45" />
      <rect x="10.2" y="10.5" width="3" height="5.6" rx="1.5" fill="#0b0b12" />
      <rect x="18.8" y="10.5" width="3" height="5.6" rx="1.5" fill="#0b0b12" />
      <path d="M10.2 19.6 Q16 25.6 21.8 19.6" fill="none" stroke="#0b0b12" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function WalletButton() {
  const { ready, connected, authenticated, address, login, logout } = useParityWallet();
  const { data: balances } = useBalances(address);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready) return <div className="h-9 w-28 animate-pulse rounded-full bg-raise" />;

  if (!connected || !address) {
    const settingUp = authenticated;
    return (
      <button
        onClick={login}
        disabled={settingUp}
        className="group relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full bg-ink pl-1 pr-4 text-sm font-medium text-bg shadow-[0_0_0_1px_rgb(255_255_255/0.25),0_8px_28px_-10px_rgb(79_99_255/0.75)] transition hover:bg-pearl disabled:cursor-wait"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg text-ink transition group-hover:scale-95">
          <HugeiconsIcon
            icon={settingUp ? Loading03Icon : Wallet01Icon}
            size={14}
            className={settingUp ? "animate-spin" : ""}
          />
        </span>
        {settingUp ? (
          "Setting up…"
        ) : (
          <>
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect wallet</span>
          </>
        )}
        {/* Sheen that sweeps across on hover. */}
        <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-white/70 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
      </button>
    );
  }

  const usdc = balances ? usd(fromRaw(balances.usdc)) : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-9 items-center gap-2 rounded-full border pl-1 pr-2.5 text-sm transition ${open ? "border-line-strong bg-white/8" : "border-line bg-white/4 hover:border-line-strong hover:bg-white/6"}`}
      >
        <Smiley address={address} />
        <span className="num hidden text-pearl sm:inline">{usdc ?? "…"}</span>
        <span className="hidden h-3.5 w-px bg-line-strong sm:block" />
        <span className="font-medium">{short(address)}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          className={`text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 520, damping: 36 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl popover"
          >
            <AccountMenu
              address={address}
              usdc={usdc}
              sol={balances?.sol ?? null}
              onDisconnect={() => {
                setOpen(false);
                void logout();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountMenu({
  address,
  usdc,
  sol,
  onDisconnect,
}: {
  address: string;
  usdc: string | null;
  sol: number | null;
  onDisconnect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const faucet = useFaucet();

  const copy = () =>
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1_500);
    });

  return (
    <>
      <div className="relative p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(79_99_255/0.22),transparent_60%)]" />
        <div className="relative flex items-center gap-3">
          <Smiley address={address} size={40} />
          <div className="min-w-0 flex-1">
            <button onClick={copy} className="group flex items-center gap-1.5 text-sm font-medium" title="Copy address">
              {short(address, 5)}
              <HugeiconsIcon
                icon={copied ? Tick02Icon : Copy01Icon}
                size={13}
                className={copied ? "text-long" : "text-dim transition group-hover:text-ink"}
              />
            </button>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-long shadow-[0_0_6px_var(--color-long)]" /> Connected · Solana
              Devnet
            </p>
          </div>
        </div>
        <div className="relative mt-4 rounded-xl border border-line bg-black/25 p-3">
          <p className="text-[11px] uppercase tracking-wider text-dim">Balance</p>
          <p className="num mt-1 text-2xl font-medium tracking-tight">
            {usdc ?? "…"} <span className="text-xs font-normal text-muted">USDC</span>
          </p>
          <p className="num mt-0.5 text-xs text-muted">{sol !== null ? sol.toFixed(4) : "…"} SOL for fees</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pb-3">
        <Tile
          onClick={faucet.claim}
          disabled={faucet.loading || !faucet.available}
          icon={<HugeiconsIcon icon={faucet.loading ? Loading03Icon : DropletIcon} size={18} className={faucet.loading ? "animate-spin" : ""} />}
          label={faucet.cooldownLabel ? `In ${faucet.cooldownLabel}` : "Faucet"}
        />
        <Tile href="/portfolio" icon={<HugeiconsIcon icon={PieChartIcon} size={18} />} label="Portfolio" />
        <Tile href={explorerAccount(address)} external icon={<HugeiconsIcon icon={ArrowUpRight01Icon} size={18} />} label="Explorer" />
      </div>

      <button
        onClick={onDisconnect}
        className="flex w-full items-center justify-center gap-2 border-t border-line py-3 text-sm text-muted transition hover:bg-short/10 hover:text-short"
      >
        <HugeiconsIcon icon={Logout01Icon} size={16} /> Disconnect
      </button>
    </>
  );
}

const tile =
  "flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white/3 px-2 py-3 text-xs text-muted transition hover:border-line-strong hover:bg-white/7 hover:text-ink";

function Tile({
  icon,
  label,
  href,
  external,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className="text-pearl">{icon}</span>
      <span className="num whitespace-nowrap">{label}</span>
    </>
  );
  if (href && external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={tile}>
        {body}
      </a>
    );
  if (href)
    return (
      <Link href={href} className={tile}>
        {body}
      </Link>
    );
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${tile} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-white/3 disabled:hover:text-muted`}
    >
      {body}
    </button>
  );
}

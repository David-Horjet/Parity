"use client";

import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, Loading03Icon } from "@hugeicons/core-free-icons";
import { bpsOf, liquidationPrice, qtyFor, quoteOpen, type Side } from "@parity/sdk";
import { useMemo, useState } from "react";
import { useBalances } from "@/hooks/use-data";
import { useTradeActions } from "@/hooks/use-trade";
import { useParityWallet } from "@/hooks/use-wallet";
import { fromRaw, pct, price, usd } from "@/lib/format";
import type { MarketDTO, PositionDTO } from "@/lib/types";
import { useFaucet } from "./faucet-button";

const PRESETS = [1, 2, 3, 5];

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="flex items-center gap-1 text-muted" title={hint}>
        {label}
        {hint && <HugeiconsIcon icon={InformationCircleIcon} size={12} className="text-dim" />}
      </span>
      <span className="num">{children}</span>
    </div>
  );
}

export function TradePanel({ market, positions }: { market: MarketDTO; positions: PositionDTO[] }) {
  const { connected, address, login } = useParityWallet();
  const { data: balances } = useBalances(address);
  const faucet = useFaucet();
  const { open, pending } = useTradeActions();
  const [side, setSide] = useState<Side>("long");
  const [marginInput, setMarginInput] = useState("");
  const [leverage, setLeverage] = useState(3);

  const maxLev = market.config.maxLeverage;
  const priceRaw = BigInt(market.price);
  const marginRaw = BigInt(Math.floor((Number(marginInput) || 0) * 1e6));
  const existing = positions.find((p) => p.market === market.address && p.side === side);
  const usdc = balances?.usdc ?? 0n;

  const quote = useMemo(
    () =>
      quoteOpen(side, marginRaw, leverage, priceRaw, {
        tradingFeeBps: market.config.tradingFeeBps,
        maintenanceMarginBps: market.config.maintenanceMarginBps,
      }),
    [side, marginRaw, leverage, priceRaw, market.config],
  );

  // Adding to a position averages entry; show the combined liquidation price.
  const liq = useMemo(() => {
    if (!existing) return quote.liquidationPrice;
    const combined = {
      side,
      margin: BigInt(existing.margin) + marginRaw,
      size: BigInt(existing.size) + quote.size,
      qty: BigInt(existing.qty) + (priceRaw > 0n ? qtyFor(quote.size, priceRaw) : 0n),
      fundingEntry: 0n,
    };
    return liquidationPrice(combined, market.config.maintenanceMarginBps);
  }, [existing, quote, marginRaw, priceRaw, side, market.config.maintenanceMarginBps]);

  const sideOi = BigInt(side === "long" ? market.longSize : market.shortSize);
  const nav = BigInt(market.vaultBalance) - BigInt(market.totalMargin);
  const oiCap = [BigInt(market.config.maxOpenInterest), bpsOf(nav > 0n ? nav : 0n, market.config.maxOiToLiquidityBps)].reduce((a, b) => (a < b ? a : b));
  const available = oiCap > sideOi ? oiCap - sideOi : 0n;
  const stale = Math.floor(Date.now() / 1000) - market.priceUpdatedAt > market.config.maxPriceAgeSecs;

  const problem = (() => {
    if (!connected) return null;
    if (market.paused) return "Market paused";
    if (stale) return "Waiting for fresh price";
    if (marginRaw === 0n) return "Enter margin";
    if (marginRaw < BigInt(market.config.minMargin)) return `Min margin ${usd(fromRaw(market.config.minMargin))}`;
    if (quote.total > usdc) return "Insufficient USDC";
    if (quote.size + BigInt(existing?.size ?? 0) > BigInt(market.config.maxPositionSize)) return "Above max position size";
    if (quote.size > available) return "Exceeds available liquidity";
    return null;
  })();

  const accent = side === "long" ? "var(--color-long)" : "var(--color-short)";
  const liqDistance = liq > 0n && priceRaw > 0n ? Number(liq) / Number(priceRaw) - 1 : null;

  const needsFaucet = connected && usdc === 0n && faucet.available;

  const submit = async () => {
    if (!connected) return login();
    if (needsFaucet) return faucet.claim();
    if (problem) return;
    const sig = await open(market, side, marginRaw, quote.size);
    if (sig) setMarginInput("");
  };

  const cta = !connected
    ? "Connect wallet"
    : needsFaucet
      ? "Get test USDC"
      : problem ?? `${side === "long" ? "Long" : "Short"} ${market.symbol}`;
  const busy = pending?.startsWith(`open:${market.symbol}`) || faucet.loading;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="relative grid grid-cols-2 rounded-xl bg-panel-2 p-1">
        <motion.span
          className="absolute inset-y-1 w-[calc(50%-4px)] rounded-lg"
          style={{ background: side === "long" ? "rgb(47 224 162 / 0.16)" : "rgb(255 93 125 / 0.16)" }}
          animate={{ left: side === "long" ? 4 : "calc(50%)" }}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
        {(["long", "short"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`relative py-2 text-sm font-medium capitalize transition ${side === s ? (s === "long" ? "text-long" : "text-short") : "text-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>Margin</span>
          <button
            className="num hover:text-ink"
            onClick={() => {
              const fee = BigInt(Math.round(leverage * 100)) * BigInt(market.config.tradingFeeBps);
              const max = (usdc * 1_000_000n) / (1_000_000n + fee);
              setMarginInput((Number(max) / 1e6).toFixed(2));
            }}
          >
            Balance {usd(fromRaw(usdc))}
          </button>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5 focus-within:border-line-strong">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            placeholder="0.00"
            value={marginInput}
            onChange={(e) => setMarginInput(e.target.value)}
            className="num w-full bg-transparent text-lg outline-none placeholder:text-dim"
          />
          <span className="text-sm text-muted">USDC</span>
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>Leverage</span>
          <span className="num text-sm font-medium text-ink">{leverage.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          className="lev w-full"
          min={1}
          max={maxLev}
          step={0.1}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          style={{ "--track-color": accent, "--fill": `${((leverage - 1) / (maxLev - 1)) * 100}%` } as React.CSSProperties}
        />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {PRESETS.filter((p) => p <= maxLev).map((p) => (
            <button
              key={p}
              onClick={() => setLeverage(p)}
              className={`rounded-lg border py-1 text-xs transition ${leverage === p ? "border-line-strong bg-raise text-ink" : "border-line text-muted hover:text-ink"}`}
            >
              {p}x
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-panel-2/50 px-3 py-2">
        <Row label="Position size">{usd(fromRaw(quote.size))}</Row>
        <Row label="Entry price" hint="Oracle price now; fills within 1% slippage">{price(fromRaw(priceRaw))}</Row>
        <Row label="Liquidation price" hint="Where equity falls to maintenance margin">
          <span className="text-warn">{liq > 0n && marginRaw > 0n ? price(fromRaw(liq)) : "–"}</span>
          {liqDistance !== null && marginRaw > 0n && <span className="ml-1 text-xs text-dim">{pct(liqDistance, 1)}</span>}
        </Row>
        <Row label={`Trading fee (${market.config.tradingFeeBps / 100}%)`}>{usd(fromRaw(quote.fee))}</Row>
        <div className="my-1 h-px bg-line" />
        <Row label="Total cost">{usd(fromRaw(quote.total))}</Row>
      </div>

      {existing && (
        <p className="text-xs text-muted">
          Adds to your open {side} of {usd(fromRaw(existing.size))}. Entry averages in.
        </p>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={submit}
        disabled={busy || (connected && !needsFaucet && !!problem)}
        className="flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold text-bg transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: !connected || needsFaucet ? "var(--color-accent)" : accent }}
      >
        {busy && <HugeiconsIcon icon={Loading03Icon} size={16} className="animate-spin" />}
        {cta}
      </motion.button>

      <div className="space-y-1 text-[11px] leading-relaxed text-dim">
        <p>
          Price follows a 5-min TWAP of {market.symbol} on Solana DEXs (Jupiter), guarded against PreStocks&apos; SPV mark.
          Max {maxLev}x · maintenance {market.config.maintenanceMarginBps / 100}%.
        </p>
        <p>Available {side} liquidity {usd(fromRaw(available), 0)}</p>
      </div>
    </div>
  );
}

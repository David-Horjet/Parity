"use client";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { useCandles } from "@/hooks/use-data";

const TIMEFRAMES = ["15m", "1h", "4h", "1d"] as const;
const SECONDS: Record<string, number> = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

export function PriceChart({
  symbol,
  livePrice,
  entry,
  liquidation,
}: {
  symbol: string;
  livePrice: number;
  entry?: number;
  liquidation?: number;
}) {
  const [tf, setTf] = useState<string>("1h");
  const { data: candles, isLoading, error } = useCandles(symbol, tf);
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lines = useRef<IPriceLine[]>([]);
  const last = useRef<{ time: number; open: number; high: number; low: number; close: number } | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a3a3a3",
        fontFamily: "var(--font-roboto)",
        attributionLogo: false,
      },
      grid: { vertLines: { color: "rgba(255,255,255,0.035)" }, horzLines: { color: "rgba(255,255,255,0.035)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#737373", labelBackgroundColor: "#2f2f2f" },
        horzLine: { color: "#737373", labelBackgroundColor: "#2f2f2f" },
      },
    });
    series.current = c.addSeries(CandlestickSeries, {
      upColor: "#2fe0a2",
      downColor: "#ff5d7d",
      borderVisible: false,
      wickUpColor: "#2fe0a2",
      wickDownColor: "#ff5d7d",
    });
    chart.current = c;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
      lines.current = [];
    };
  }, []);

  useEffect(() => {
    if (!series.current || !candles) return;
    series.current.setData(candles.map((k) => ({ ...k, time: k.time as UTCTimestamp })));
    last.current = candles[candles.length - 1] ?? null;
    chart.current?.timeScale().fitContent();
  }, [candles]);

  // Extend the latest candle with the live perp price.
  useEffect(() => {
    if (!series.current || !last.current || !livePrice) return;
    const step = SECONDS[tf]!;
    const now = Math.floor(Date.now() / 1000);
    const bucket = now - (now % step);
    const prev = last.current;
    const bar =
      bucket > prev.time
        ? { time: bucket, open: prev.close, high: Math.max(prev.close, livePrice), low: Math.min(prev.close, livePrice), close: livePrice }
        : { ...prev, high: Math.max(prev.high, livePrice), low: Math.min(prev.low, livePrice), close: livePrice };
    last.current = bar;
    series.current.update({ ...bar, time: bar.time as UTCTimestamp });
  }, [livePrice, tf]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    lines.current.forEach((l) => s.removePriceLine(l));
    lines.current = [];
    if (entry) lines.current.push(s.createPriceLine({ price: entry, color: "#d4d4d4", lineStyle: LineStyle.Dashed, lineWidth: 1, title: "Entry" }));
    if (liquidation) lines.current.push(s.createPriceLine({ price: liquidation, color: "#ffc15c", lineStyle: LineStyle.Dashed, lineWidth: 1, title: "Liq." }));
  }, [entry, liquidation, candles]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => setTf(t)}
            className={`rounded-md px-2 py-1 text-xs transition ${tf === t ? "bg-raise text-ink" : "text-muted hover:text-ink"}`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-dim">
          {symbol} spot on Solana DEXs · live perp price
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={el} className="absolute inset-0" />
        {(isLoading || error) && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            {error ? "Chart data unavailable" : "Loading chart…"}
          </div>
        )}
      </div>
    </div>
  );
}

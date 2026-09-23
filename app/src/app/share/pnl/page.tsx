/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pct, signedUsd } from "@/lib/format";
import { fromQuery, toQuery } from "@/lib/pnl-card";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(searchParams: Props["searchParams"]) {
  const raw = await searchParams;
  const q = new URLSearchParams(Object.entries(raw).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
  return fromQuery(q);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const card = await load(searchParams);
  if (!card) return {};
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const title = `${signedUsd(card.pnl)} (${pct(card.roe)}) on ${card.symbol} | Parity`;
  const description = `${card.side === "long" ? "Long" : "Short"} ${card.leverage.toFixed(1)}x on ${card.symbol}. Trade pre-IPO perpetuals on Parity.`;
  const image = { url: `/api/pnl-card?${toQuery(card)}`, width: 900, height: 1440 };
  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function SharePnlPage({ searchParams }: Props) {
  const card = await load(searchParams);
  if (!card) notFound();
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-10">
      <img
        src={`/api/pnl-card?${toQuery(card)}`}
        alt={`${card.symbol} PnL card`}
        width={900}
        height={1440}
        className="w-full rounded-2xl border border-line"
      />
      <Link
        href={`/trade/${card.symbol}`}
        className="mt-6 flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-bold text-bg"
      >
        Trade {card.symbol} on Parity
      </Link>
    </main>
  );
}

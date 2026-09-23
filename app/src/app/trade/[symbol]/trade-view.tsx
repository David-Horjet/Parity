"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MarketSelector } from "@/components/market-selector";
import { MarketStats } from "@/components/market-stats";
import { PositionsTabs } from "@/components/positions-panel";
import { PriceChart } from "@/components/price-chart";
import { TradePanel } from "@/components/trade-panel";
import { useMarkets } from "@/hooks/use-data";
import { useLivePositions } from "@/hooks/use-live-positions";
import { useParityWallet } from "@/hooks/use-wallet";
import { fromRaw } from "@/lib/format";

export function TradeView({ symbol }: { symbol: string }) {
  const router = useRouter();
  const { data: markets, error } = useMarkets();
  const { address } = useParityWallet();
  const { positions, raw } = useLivePositions(address);
  const market = markets?.find((m) => m.symbol === symbol);

  useEffect(() => {
    if (markets && !market && markets[0]) router.replace(`/trade/${markets[0].symbol}`);
  }, [markets, market, router]);

  if (error) {
    return <p className="p-10 text-center text-muted">Couldn&apos;t load markets: {(error as Error).message}</p>;
  }
  if (!market || !markets) {
    return (
      <div className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-3 p-3 lg:grid-cols-[1fr_360px]">
        <div className="h-[560px] animate-pulse rounded-2xl panel" />
        <div className="h-[560px] animate-pulse rounded-2xl panel" />
      </div>
    );
  }

  const here = positions.filter((p) => p.market.symbol === symbol);
  const focus = here[0];

  return (
    <main className="mx-auto grid max-w-[1600px] grid-cols-[minmax(0,1fr)] gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-w-0 flex-col gap-3">
        <div className="relative z-20 flex flex-col gap-3 rounded-2xl panel p-2 md:flex-row md:items-center">
          <MarketSelector markets={markets} current={market} />
          <div className="hidden h-8 w-px bg-line md:block" />
          <div className="min-w-0 flex-1">
            <MarketStats market={market} />
          </div>
          <a
            href={market.url}
            target="_blank"
            rel="noreferrer"
            className="hidden shrink-0 items-center gap-1 px-2 text-xs text-muted hover:text-accent 2xl:flex"
          >
            PreStocks <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} />
          </a>
        </div>
        <div className="h-[440px] overflow-hidden rounded-2xl panel lg:h-[520px]">
          <PriceChart
            symbol={symbol}
            livePrice={fromRaw(market.price)}
            entry={focus?.entry}
            liquidation={focus?.liquidation}
          />
        </div>
        <div className="hidden overflow-hidden rounded-2xl panel lg:block">
          <PositionsTabs positions={positions} address={address} />
        </div>
      </section>
      <aside className="h-fit rounded-2xl panel lg:sticky lg:top-[4.25rem]">
        <TradePanel market={market} positions={raw} />
        <div className="border-t border-line p-4">
          <p className="text-xs uppercase tracking-wider text-dim">About</p>
          <p className="mt-1 text-lg font-medium">{market.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{market.description}</p>
        </div>
      </aside>
      <div className="overflow-hidden rounded-2xl panel lg:hidden">
        <PositionsTabs positions={positions} address={address} />
      </div>
    </main>
  );
}

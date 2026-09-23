import { TradeView } from "./trade-view";

export default async function TradePage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <TradeView symbol={symbol.toUpperCase()} />;
}

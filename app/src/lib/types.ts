/** JSON shapes returned by the app's API routes. Integer amounts are 6-decimal strings. */

export interface MarketDTO {
  symbol: string;
  name: string;
  description: string;
  image: string;
  url: string;
  mint: string;
  address: string;
  paused: boolean;
  price: string;
  priceUpdatedAt: number;
  markPrice: number | null;
  tokenPrice: number | null;
  markValuation: number | null;
  impliedValuation: number | null;
  change24h: number | null;
  supply: number | null;
  longSize: string;
  shortSize: string;
  longQty: string;
  shortQty: string;
  longFundingEntry: string;
  shortFundingEntry: string;
  totalMargin: string;
  fundingIndex: string;
  fundingUpdatedAt: number;
  vaultBalance: string;
  lpShares: string;
  config: {
    maxLeverage: number;
    maintenanceMarginBps: number;
    tradingFeeBps: number;
    liquidationFeeBps: number;
    minMargin: string;
    maxPositionSize: string;
    maxOpenInterest: string;
    maxOiToLiquidityBps: number;
    maxPriceAgeSecs: number;
    maxFundingRateBpsPerHour: number;
  };
}

export interface PositionDTO {
  address: string;
  owner: string;
  market: string;
  symbol: string;
  side: "long" | "short";
  margin: string;
  size: string;
  qty: string;
  fundingEntry: string;
  openedAt: number;
}

export interface TradeDTO {
  signature: string;
  kind: "open" | "close" | "liquidate";
  symbol: string | null;
  side: "long" | "short";
  margin: number;
  size: number;
  price: number;
  entry_price: number | null;
  pnl: number | null;
  funding: number | null;
  fee: number | null;
  payout: number | null;
  ts: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LpDTO {
  market: string;
  symbol: string;
  shares: string;
}

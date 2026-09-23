import {
  fundingRatePerHour,
  liquidationPrice,
  positionEquity,
  projectedFundingIndex,
  entryPrice,
  lpNav,
} from "@parity/sdk";
import type { MarketDTO, PositionDTO } from "./types";

export function fundingState(m: MarketDTO) {
  return {
    longSize: BigInt(m.longSize),
    shortSize: BigInt(m.shortSize),
    fundingIndex: BigInt(m.fundingIndex),
    fundingUpdatedAt: m.fundingUpdatedAt,
    maxFundingRateBpsPerHour: m.config.maxFundingRateBpsPerHour,
  };
}

export function bookState(m: MarketDTO) {
  return {
    ...fundingState(m),
    longQty: BigInt(m.longQty),
    shortQty: BigInt(m.shortQty),
    longFundingEntry: BigInt(m.longFundingEntry),
    shortFundingEntry: BigInt(m.shortFundingEntry),
    totalMargin: BigInt(m.totalMargin),
    price: BigInt(m.price),
  };
}

/** LP net asset value in USD, with funding projected to now. */
export function marketNav(m: MarketDTO, nowSecs = Math.floor(Date.now() / 1000)) {
  const book = bookState(m);
  return Number(lpNav(book, BigInt(m.vaultBalance), projectedFundingIndex(book, nowSecs))) / 1e6;
}

export const marketFundingRate = (m: MarketDTO) => fundingRatePerHour(fundingState(m));

export interface LivePosition {
  position: PositionDTO;
  market: MarketDTO;
  margin: number;
  size: number;
  entry: number;
  mark: number;
  pnl: number;
  funding: number;
  equity: number;
  roe: number;
  leverage: number;
  liquidation: number;
  closeFee: number;
}

export function livePosition(p: PositionDTO, m: MarketDTO, nowSecs = Math.floor(Date.now() / 1000)): LivePosition {
  const pos = {
    side: p.side,
    margin: BigInt(p.margin),
    size: BigInt(p.size),
    qty: BigInt(p.qty),
    fundingEntry: BigInt(p.fundingEntry),
  };
  const index = projectedFundingIndex(fundingState(m), nowSecs);
  const price = BigInt(m.price);
  const { equity, pnl, funding } = positionEquity(pos, price, index);
  const liq = liquidationPrice(pos, m.config.maintenanceMarginBps, funding);
  const margin = Number(pos.margin) / 1e6;
  const size = Number(pos.size) / 1e6;
  return {
    position: p,
    market: m,
    margin,
    size,
    entry: Number(entryPrice(pos.size, pos.qty)) / 1e6,
    mark: Number(price) / 1e6,
    pnl: Number(pnl) / 1e6,
    funding: Number(funding) / 1e6,
    equity: Number(equity) / 1e6,
    roe: Number(pnl - funding) / Number(pos.margin),
    leverage: size / margin,
    liquidation: Number(liq) / 1e6,
    closeFee: (size * m.config.tradingFeeBps) / 10_000,
  };
}

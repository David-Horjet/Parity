import type { PreStocksAsset } from "./validation";

/**
 * Assets that must not get a perp market. SPACEX has gone public and its token
 * is in a conversion window; nothing in the API payload flags that.
 */
export const DENYLIST = new Set(["SPACEX"]);

export interface MarketInfo {
  symbol: string;
  name: string;
  description: string;
  image: string;
  url: string;
  mint: string;
  markPrice: number;
  markValuation: number;
  tokenPrice: number;
  impliedValuation: number;
  supply: number;
}

function cleanName(name: string) {
  return name.replace(/\s*PreStocks$/i, "").trim();
}

function cleanDescription(description: string) {
  // Drop the boilerplate backing paragraph; keep the company summary.
  return description.split("\n\n")[0]?.trim() ?? "";
}

export function toMarkets(assets: PreStocksAsset[], denylist: Set<string> = DENYLIST): MarketInfo[] {
  return assets
    .filter((a) => !denylist.has(a.symbol))
    .map((a) => ({
      symbol: a.symbol,
      name: cleanName(a.name),
      description: cleanDescription(a.description),
      image: a.image,
      url: a.external_url,
      mint: a.contract_address,
      markPrice: a.markPrice,
      markValuation: a.markValuation,
      tokenPrice: a.tokenPrice,
      impliedValuation: a.impliedValuation,
      supply: a.supply,
    }))
    .sort((a, b) => b.markValuation - a.markValuation);
}

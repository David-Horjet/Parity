import {
  jupiterPriceSchema,
  jupiterResponseSchema,
  parseEach,
  preStocksAssetSchema,
  preStocksResponseSchema,
  type JupiterPrice,
  type PreStocksAsset,
} from "./validation";

export const PRESTOCKS_API = "https://prestocks.com/api/prestocks";
export const JUPITER_PRICE_API = "https://lite-api.jup.ag/price/v3";

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
}

async function getJson(url: string, opts: FetchOptions = {}): Promise<unknown> {
  const { timeoutMs = 8_000, retries = 2, fetchImpl = fetch } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${url} responded ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function fetchPreStocksAssets(opts?: FetchOptions): Promise<PreStocksAsset[]> {
  const raw = preStocksResponseSchema.parse(await getJson(PRESTOCKS_API, opts));
  return parseEach(raw, preStocksAssetSchema).ok;
}

/** Jupiter Price API v3, keyed by mint. Mints Jupiter doesn't price are omitted. */
export async function fetchJupiterPrices(
  mints: string[],
  opts?: FetchOptions,
): Promise<Record<string, JupiterPrice>> {
  if (mints.length === 0) return {};
  const url = `${JUPITER_PRICE_API}?ids=${mints.join(",")}`;
  const raw = jupiterResponseSchema.parse(await getJson(url, opts));
  const out: Record<string, JupiterPrice> = {};
  for (const mint of mints) {
    const res = jupiterPriceSchema.safeParse(raw[mint]);
    if (res.success) out[mint] = res.data;
  }
  return out;
}

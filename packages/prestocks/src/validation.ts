import { z } from "zod";

const positive = z.number().finite().positive();
const base58Address = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "invalid mint address");

export const preStocksAssetSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().regex(/^[A-Z0-9]{1,16}$/),
  description: z.string().default(""),
  image: z.string().url(),
  external_url: z.string().url(),
  contract_address: base58Address,
  markPrice: positive,
  markValuation: positive,
  tokenPrice: positive,
  impliedValuation: positive,
  supply: z.number().finite().nonnegative(),
});

export const preStocksResponseSchema = z.array(z.unknown());

export type PreStocksAsset = z.infer<typeof preStocksAssetSchema>;

export const jupiterPriceSchema = z.object({
  usdPrice: positive,
  liquidity: z.number().finite().nonnegative(),
  decimals: z.number().int(),
  blockId: z.number().int().nullable().optional(),
  priceChange24h: z.number().finite().nullable().optional(),
  stockData: z
    .object({
      id: z.string(),
      price: positive,
      mcap: z.number().finite().nullable().optional(),
      updatedAt: z.string(),
    })
    .optional(),
  scaledUiConfig: z
    .object({
      multiplier: z.number().positive(),
      newMultiplier: z.number().positive(),
      newMultiplierEffectiveAt: z.string(),
    })
    .partial()
    .optional(),
});

export const jupiterResponseSchema = z.record(z.string(), z.unknown());

export type JupiterPrice = z.infer<typeof jupiterPriceSchema>;

/** Parse each entry on its own so one malformed asset doesn't drop the whole feed. */
export function parseEach<T>(items: unknown[], schema: z.ZodType<T>): { ok: T[]; rejected: number } {
  const ok: T[] = [];
  let rejected = 0;
  for (const item of items) {
    const res = schema.safeParse(item);
    if (res.success) ok.push(res.data);
    else rejected++;
  }
  return { ok, rejected };
}

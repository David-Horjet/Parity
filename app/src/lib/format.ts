export const usd = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

export const price = (v: number) => usd(v, v >= 100 ? 2 : 4);

export const compact = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });

export const pct = (v: number, digits = 2) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;

export const signedUsd = (v: number) => `${v >= 0 ? "+" : "-"}${usd(Math.abs(v))}`;

export const short = (addr: string, n = 4) => `${addr.slice(0, n)}…${addr.slice(-n)}`;

export const fromRaw = (v: string | bigint) => Number(v) / 1e6;

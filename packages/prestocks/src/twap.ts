import type { PriceSample } from "./prices";

export interface GuardConfig {
  /** TWAP window. */
  windowMs: number;
  /** Minimum samples in the window before publishing. */
  minSamples: number;
  /** Samples older than this are ignored. */
  maxSampleAgeMs: number;
  /** Max |spot/mark - 1| allowed. */
  maxPremium: number;
  /** Minimum Jupiter liquidity in USD. */
  minLiquidity: number;
}

export const DEFAULT_GUARDS: GuardConfig = {
  windowMs: 5 * 60_000,
  minSamples: 3,
  maxSampleAgeMs: 60_000,
  maxPremium: 0.6,
  minLiquidity: 25_000,
};

export type GuardFailure = "liquidity" | "premium" | "stale";

export function checkSample(s: PriceSample, g: GuardConfig, now = Date.now()): GuardFailure | null {
  if (now - s.timestamp > g.maxSampleAgeMs) return "stale";
  if (s.liquidity < g.minLiquidity) return "liquidity";
  if (Math.abs(s.premium) > g.maxPremium) return "premium";
  return null;
}

/** Rolling time-weighted average of accepted spot samples, per symbol. */
export class Twap {
  private samples: PriceSample[] = [];

  constructor(private readonly guards: GuardConfig = DEFAULT_GUARDS) {}

  /** Returns the guard failure if the sample was rejected. */
  push(sample: PriceSample, now = Date.now()): GuardFailure | null {
    const failure = checkSample(sample, this.guards, now);
    if (failure) return failure;
    this.samples.push(sample);
    this.prune(now);
    return null;
  }

  private prune(now: number) {
    const cutoff = now - this.guards.windowMs;
    // Keep one sample before the window so the first interval is weighted correctly.
    let firstInside = this.samples.findIndex((s) => s.timestamp >= cutoff);
    if (firstInside === -1) firstInside = this.samples.length;
    this.samples = this.samples.slice(Math.max(0, firstInside - 1));
  }

  get size() {
    return this.samples.length;
  }

  latest(): PriceSample | undefined {
    return this.samples[this.samples.length - 1];
  }

  /** Null until enough samples exist or if the newest sample is stale. */
  value(now = Date.now()): number | null {
    this.prune(now);
    const last = this.latest();
    if (!last || now - last.timestamp > this.guards.maxSampleAgeMs) return null;
    if (this.samples.length < this.guards.minSamples) return null;

    const start = now - this.guards.windowMs;
    let weighted = 0;
    let total = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i]!;
      const from = Math.max(s.timestamp, start);
      const to = i + 1 < this.samples.length ? this.samples[i + 1]!.timestamp : now;
      const dt = Math.max(0, to - from);
      weighted += s.spot * dt;
      total += dt;
    }
    return total > 0 ? weighted / total : last.spot;
  }
}

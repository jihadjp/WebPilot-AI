export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
  retryAfterSeconds: number;
}

export class SlidingWindowRateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private hits = new Map<string, number[]>();

  constructor(windowMs: number = 60_000, maxRequests: number = 30) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  public check(key: string, nowMs: number = Date.now()): RateLimitDecision {
    const cutoff = nowMs - this.windowMs;
    const existing = (this.hits.get(key) || []).filter((ts) => ts > cutoff);

    if (existing.length >= this.maxRequests) {
      const oldest = existing[0];
      const resetAtMs = oldest + this.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000));
      this.hits.set(key, existing);
      return {
        allowed: false,
        remaining: 0,
        resetAtMs,
        retryAfterSeconds,
      };
    }

    existing.push(nowMs);
    this.hits.set(key, existing);

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.length),
      resetAtMs: nowMs + this.windowMs,
      retryAfterSeconds: 0,
    };
  }

  public reset(key?: string): void {
    if (key) {
      this.hits.delete(key);
    } else {
      this.hits.clear();
    }
  }
}

/**
 * Failed-login throttle per account, on top of the per-IP rate limit: a botnet spreading guesses over many
 * addresses is still stopped after `limit` failures per window against one e-mail. A success clears the counter.
 * Kept in memory (one server process); the map is bounded so it cannot be used to exhaust memory.
 */
export class LoginThrottle {
  private hits = new Map<string, { n: number; until: number }>();
  constructor(private limit: number, private windowMs = 15 * 60 * 1000, private maxKeys = 10_000, private now = () => Date.now()) {}

  /** Seconds to wait before another try, or 0 when allowed. */
  retryAfter(key: string): number {
    const h = this.hits.get(key);
    if (!h) return 0;
    if (h.until <= this.now()) { this.hits.delete(key); return 0; }
    return h.n >= this.limit ? Math.ceil((h.until - this.now()) / 1000) : 0;
  }
  fail(key: string) {
    const t = this.now();
    const h = this.hits.get(key);
    if (h && h.until > t) h.n += 1;
    else {
      if (this.hits.size >= this.maxKeys) this.sweep(t);
      if (this.hits.size >= this.maxKeys) this.hits.delete(this.hits.keys().next().value as string);
      this.hits.set(key, { n: 1, until: t + this.windowMs });
    }
  }
  ok(key: string) { this.hits.delete(key); }
  private sweep(t: number) { for (const [k, v] of this.hits) if (v.until <= t) this.hits.delete(k); }
}

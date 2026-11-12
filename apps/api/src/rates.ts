import type { FxSnapshot, Store } from './store.js';

export interface RatesResult extends FxSnapshot {
  /** True when the provider was unreachable and an older snapshot is served. */
  stale: boolean;
}

const FRESH_MS = 6 * 60 * 60 * 1000;

/** Daily reference rates from Frankfurter (free, no key), cached in memory and in the database. */
export function createRates(store: Store, baseUrl: string, doFetch: typeof fetch = fetch) {
  const memory = new Map<string, { at: number; snap: FxSnapshot }>();
  const root = baseUrl.replace(/\/$/, '');

  return {
    async get(base: string): Promise<RatesResult> {
      const b = base.toUpperCase();
      const hot = memory.get(b);
      if (hot && Date.now() - hot.at < FRESH_MS) return { ...hot.snap, stale: false };

      try {
        const res = await doFetch(`${root}/rates?base=${encodeURIComponent(b)}`, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = (await res.json()) as { date: string; quote: string; rate: number }[];
        if (!Array.isArray(rows) || rows.length === 0) throw new Error('empty');
        const rates: Record<string, number> = { [b]: 1 };
        for (const r of rows) if (typeof r.rate === 'number' && r.rate > 0) rates[r.quote] = r.rate;
        const snap: FxSnapshot = { base: b, date: rows[0]!.date, rates };
        memory.set(b, { at: Date.now(), snap });
        await store.putFx(snap).catch(() => {});
        return { ...snap, stale: false };
      } catch {
        const old = hot?.snap ?? (await store.getFx(b));
        if (old) return { ...old, stale: true };
        throw new Error('Exchange rates are unavailable right now.');
      }
    },
  };
}
export type Rates = ReturnType<typeof createRates>;

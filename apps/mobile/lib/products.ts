import { api } from '@/lib/api';
import { productKey, type ProductInfo } from '@/lib/domain/product-info';
import { useSettings } from '@/lib/store/settings-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Device-side cache of Gemini product facts. The server caches too; this saves round trips and works offline. */
const useProductCache = create<{ byKey: Record<string, ProductInfo> }>()(
  persist(() => ({ byKey: {} as Record<string, ProductInfo> }), {
    name: 'ghost-kitchen-products',
    version: 1,
    storage: createJSONStorage(() => AsyncStorage),
  })
);

export type LookupStatus = 'ok' | 'partial' | 'offline' | 'ai-off' | 'quota' | 'error';

/**
 * Storage facts for each name (null when unknown). Never throws: when the server or AI is unavailable,
 * callers fall back to the rough category estimate and the user confirms the date anyway.
 */
export async function lookupProducts(names: string[]): Promise<{ info: Map<string, ProductInfo | null>; status: LookupStatus }> {
  const info = new Map<string, ProductInfo | null>();
  const cache = useProductCache.getState().byKey;
  const missing: string[] = [];
  for (const n of names) {
    const k = productKey(n);
    if (!k) continue;
    if (cache[k]) info.set(n, cache[k]);
    else { info.set(n, null); missing.push(n); }
  }
  if (missing.length === 0) return { info, status: 'ok' };
  const aiOff = useSettings.getState().settings.tesseractOnly;

  try {
    const fresh: Record<string, ProductInfo> = {};
    for (let i = 0; i < missing.length; i += 60) {
      const res = await api.productInfo(missing.slice(i, i + 60), !aiOff);
      for (const [name, p] of Object.entries(res.products)) {
        info.set(name, p);
        if (p) fresh[productKey(name)] = p;
      }
      if (res.ai === 'quota') return save(fresh, info, 'quota');
      if (res.ai === 'skipped' || res.ai === 'disabled') return save(fresh, info, 'ai-off');
      if (res.ai === 'error') return save(fresh, info, 'error');
    }
    return save(fresh, info, [...info.values()].some((v) => v === null) ? 'partial' : 'ok');
  } catch {
    return { info, status: 'offline' };
  }
}

function save(fresh: Record<string, ProductInfo>, info: Map<string, ProductInfo | null>, status: LookupStatus) {
  // Demo answers stay out of the cache, so they never stand in for real lookups later.
  if (Object.keys(fresh).length && !useSettings.getState().settings.demoMode) useProductCache.setState((s) => ({ byKey: { ...s.byKey, ...fresh } }));
  return { info, status };
}

export const LOOKUP_MESSAGE: Record<LookupStatus, string | null> = {
  ok: null,
  partial: 'Some items could not be identified, so their dates are rough estimates.',
  offline: "Couldn't reach the server, so dates are rough estimates for each kind of food.",
  'ai-off': 'AI is off, so dates are rough estimates for each kind of food.',
  quota: "Today's AI budget is used up, so some dates are rough estimates.",
  error: 'The AI service had a problem, so some dates are rough estimates.',
};

export const clearProductCache = () => useProductCache.setState({ byKey: {} });

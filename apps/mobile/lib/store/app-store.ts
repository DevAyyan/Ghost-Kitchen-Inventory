import { toMinor } from '@/lib/currency/money';
import { daysBetween, today } from '@/lib/domain/dates';
import { type Draft, parsePrice, parseQty } from '@/lib/domain/draft';
import { afterSniff, makeItem, newId, stageOf } from '@/lib/domain/expiry';
import { addToList } from '@/lib/domain/shopping';
import { cookAmount } from '@/lib/domain/cooking';
import { HIGH_RISK_CATEGORIES } from '@/lib/domain/catalog';
import type { Category, IsoDate, Item, ItemEvent, PlanEntry, Receipt, ShoppingItem, Stage, Unit, Zone } from '@/lib/domain/types';
import { deleteFoodPhoto } from '@/lib/photos';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { APP_STORE_VERSION, migrateAppData, pruneFinished } from './migrations';
import { SAMPLE_CURRENCY, sampleData } from './seed';
import { useSettings } from './settings-store';
import { safeStorage } from './storage';
import { useAuthStore } from './auth-store';

/** History says who did it, when someone is signed in (see ItemEvent.by). */
const byMe = (): { by?: string } => { const id = useAuthStore.getState().me?.id; return id ? { by: id } : {}; };

/** A fridge item a recipe uses, as returned by the recipe API. `uses`: amounts the recipe calls for. */
export interface CookPlan { title: string; itemIds: string[]; uses?: Record<string, { amount: number; unit: Unit }> }

interface AppState {
  items: Item[];
  receipts: Receipt[];
  events: ItemEvent[];
  recentCurrencies: string[];
  /** Store name -> currency the user chose for it (SDS 3.2 store hints). */
  storeHints: Record<string, string>;
  shopping: ShoppingItem[];
  plan: PlanEntry[];

  rememberCurrency: (code: string) => void;
  /**
   * Records that `amount` (in the item's unit, e.g. 3 eggs or 0.4 kg) was used. Using everything that's
   * left finishes the item. Returns the money value of what was used.
   */
  consumeItem: (id: string, amount: number) => { value: number; stage: Stage; finished: boolean; amount: number } | null;
  /** `wentOff`: it went bad before its date (teaches the learning loop), rather than just not wanted. */
  discardItem: (id: string, opts?: { wentOff?: boolean }) => { value: number; currency: string } | null;
  /** A passed "still looks fine" check. Returns the new date, or null when the check isn't allowed. */
  sniffItem: (id: string) => IsoDate | null;
  /** Changing the date counts as confirming it. */
  setExpiry: (id: string, expires: IsoDate) => void;
  confirmExpiry: (id: string) => void;
  setPhoto: (id: string, photoUri: string | undefined) => void;
  /** Changes an item's type (its placeholder icon). Dates stay as they are. */
  setCategory: (id: string, category: Category) => void;
  /** Moves an item to another section with the new expiry the user saw (and maybe confirmed). */
  moveItem: (id: string, to: Zone, expires: IsoDate, shelfDays: number, confirmed: boolean) => void;
  commitDraft: (draft: Draft) => string[];
  cookRecipe: (plan: CookPlan) => { count: number; saved: { minor: number; currency: string }[] };
  /** Returns false when the same food is already waiting on the list. */
  addShopping: (name: string, opts?: { amount?: string; source?: ShoppingItem['source'] }) => boolean;
  toggleShopping: (id: string) => void;
  removeShopping: (id: string) => void;
  clearCheckedShopping: () => number;
  addPlan: (entry: Omit<PlanEntry, 'id' | 'cooked'>) => string;
  movePlan: (id: string, date: IsoDate) => void;
  removePlan: (id: string) => void;
  /** Cooks a planned meal: uses its fridge items like a recipe and marks it cooked. */
  cookPlan: (id: string) => { count: number; saved: { minor: number; currency: string }[] } | null;
  /**
   * Puts a cooked meal's leftovers in the fridge. Always high risk with the short leftovers estimate, and
   * the date stays an estimate until the user confirms it. Returns the new item's id.
   */
  addLeftovers: (title: string) => string;
  /** Opt-in demo content for trying the app. Adds to whatever is already there. */
  loadSampleData: () => void;
  /** Deletes items, receipts, history and photos. Settings (a separate store) stay. */
  clearAllData: () => void;
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      items: [],
      receipts: [],
      events: [],
      recentCurrencies: [],
      storeHints: {},
      shopping: [],
      plan: [],

      rememberCurrency: (code) =>
        set((s) => ({ recentCurrencies: [code, ...s.recentCurrencies.filter((c) => c !== code)].slice(0, 3) })),

      consumeItem: (id, amount) => {
        const it = get().items.find((i) => i.id === id);
        if (!it || it.status !== 'active' || !(amount > 0)) return null;
        const stage = stageOf(it);
        const left = it.qty * it.fraction;
        const used = Math.min(amount, left);
        // Tiny float leftovers (0.0000001 kg) count as finished.
        const finished = left - used <= Math.max(1e-6, left * 1e-6);
        const portion = finished ? it.fraction : used / it.qty;
        const value = Math.round(it.priceMinor * portion);
        const fraction = finished ? 0 : it.fraction - portion;
        const event: ItemEvent = {
          id: newId('e'), type: 'used', name: it.name, category: it.category, itemId: it.id,
          minor: value, currency: it.currency, stage, date: today(), amount: finished ? left : used, unit: it.unit,
          ...(finished ? { finished: true } : {}), ...byMe(),
        };
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, fraction: finished ? 0 : fraction, status: finished ? 'used' : 'active' } : i)),
          events: [event, ...s.events],
        }));
        return { value, stage, finished, amount: finished ? left : used };
      },

      discardItem: (id, opts) => {
        const it = get().items.find((i) => i.id === id);
        if (!it || it.status !== 'active') return null;
        const value = Math.round(it.priceMinor * it.fraction);
        // Only a date the user didn't push back says how long the food really lasts.
        const teaches = !!opts?.wentOff && it.expirySource !== 'sniff' && it.expirySource !== 'user';
        const event: ItemEvent = {
          id: newId('e'), type: 'discarded', name: it.name, category: it.category, itemId: it.id, minor: value,
          amount: it.qty * it.fraction, unit: it.unit,
          currency: it.currency, stage: stageOf(it), date: today(), purchased: it.purchased,
          shelfDays: it.shelfDays, ...(teaches ? { wentOff: true } : {}), ...byMe(),
        };
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, status: 'discarded', fraction: 0 } : i)),
          events: [event, ...s.events],
        }));
        return { value, currency: it.currency };
      },

      setExpiry: (id, expires) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? { ...i, expires, expirySource: 'user', expiryConfirmed: true, shelfDays: Math.max(1, daysBetween(i.purchased, expires)) }
              : i
          ),
        })),

      sniffItem: (id) => {
        const it = get().items.find((i) => i.id === id);
        const next = it && it.status === 'active' ? afterSniff(it) : null;
        if (!next) return null;
        set((s) => ({ items: s.items.map((i) => (i.id === id ? next : i)) }));
        return next.expires;
      },

      confirmExpiry: (id) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, expiryConfirmed: true } : i)) })),

      moveItem: (id, to, expires, shelfDays, confirmed) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              ? { ...i, zone: to, expires, shelfDays, expiryConfirmed: confirmed, expirySource: confirmed ? 'user' : i.life ? 'model' : 'category' }
              : i
          ),
        })),

      setCategory: (id, category) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id
              // A risk flag that came from the product itself (not its old type) survives the change.
              ? { ...i, category, highRisk: HIGH_RISK_CATEGORIES.has(category) || (i.highRisk && !HIGH_RISK_CATEGORIES.has(i.category)) }
              : i
          ),
        })),

      setPhoto: (id, photoUri) => {
        const old = get().items.find((i) => i.id === id)?.photoUri;
        if (old && old !== photoUri) deleteFoodPhoto(old);
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, photoUri } : i)) }));
      },

      commitDraft: (draft) => {
        const lines = draft.lines.filter((l) => l.include && l.name.trim());
        // validateDraft has already rejected bad prices; clamp anyway so the receipt total can't go negative.
        const minor = lines.map((l) => { const p = parsePrice(l.price); return Number.isFinite(p) && p > 0 ? toMinor(p, draft.currency) : 0; });
        const added = lines.flatMap((l, idx) =>
          l.nonFood
            ? []
            : [makeItem({
                name: l.name, category: l.category, qty: parseQty(l.qty) || 1, unit: l.unit, priceMinor: minor[idx],
                currency: draft.currency, purchased: draft.date, photoUri: l.photoUri, zone: l.zone,
                expires: l.expires, expiryConfirmed: l.expiryConfirmed, expirySource: l.expirySource, info: l.info,
              })]
        );
        // An item photo has no price and no receipt to record.
        const receipt: Receipt | null = draft.source === 'photo' ? null : { id: newId('r'), store: draft.store, date: draft.date, currency: draft.currency, totalMinor: minor.reduce((a, b) => a + b, 0) };
        set((s) => ({
          items: [...s.items, ...added],
          receipts: receipt ? [receipt, ...s.receipts] : s.receipts,
          storeHints: draft.currencySource === 'user' && draft.source !== 'manual' ? { ...s.storeHints, [draft.store]: draft.currency } : s.storeHints,
        }));
        return added.map((i) => i.id);
      },

      cookRecipe: (plan) => {
        const saved: { minor: number; currency: string }[] = [];
        let count = 0;
        for (const id of [...new Set(plan.itemIds)]) {
          const it = get().items.find((i) => i.id === id);
          if (!it) continue;
          const res = get().consumeItem(id, cookAmount(it, plan.uses?.[id]).amount);
          if (!res) continue;
          count++;
          if (res.stage !== 'fresh') saved.push({ minor: res.value, currency: it.currency });
        }
        return { count, saved };
      },

      addShopping: (name, opts) => {
        const line: ShoppingItem = {
          id: newId('s'), name: name.trim().slice(0, 80), amount: (opts?.amount ?? '').trim().slice(0, 40),
          checked: false, source: opts?.source ?? 'manual', added: today(),
        };
        const before = get().shopping;
        const next = addToList(before, line);
        if (next === before) return false;
        set({ shopping: next });
        return true;
      },
      toggleShopping: (id) =>
        set((s) => ({ shopping: s.shopping.map((l) => (l.id === id ? { ...l, checked: !l.checked } : l)) })),
      removeShopping: (id) => set((s) => ({ shopping: s.shopping.filter((l) => l.id !== id) })),
      clearCheckedShopping: () => {
        const n = get().shopping.filter((l) => l.checked).length;
        set((s) => ({ shopping: s.shopping.filter((l) => !l.checked) }));
        return n;
      },

      addPlan: (entry) => {
        const id = newId('p');
        set((s) => ({ plan: [...s.plan, { ...entry, id, cooked: false }].sort((a, b) => a.date.localeCompare(b.date)) }));
        return id;
      },
      movePlan: (id, date) =>
        set((s) => ({ plan: s.plan.map((p) => (p.id === id ? { ...p, date } : p)).sort((a, b) => a.date.localeCompare(b.date)) })),
      removePlan: (id) => set((s) => ({ plan: s.plan.filter((p) => p.id !== id) })),
      cookPlan: (id) => {
        const entry = get().plan.find((p) => p.id === id);
        if (!entry || entry.cooked) return null;
        const res = get().cookRecipe({ title: entry.title, itemIds: entry.itemIds, uses: entry.uses });
        set((s) => ({ plan: s.plan.map((p) => (p.id === id ? { ...p, cooked: true } : p)) }));
        return res;
      },
      addLeftovers: (title) => {
        // No price: what it cost is already counted in the ingredients it used.
        const item = makeItem({
          name: `${title.trim().slice(0, 68)} leftovers`, category: 'leftovers', zone: 'fridge',
          priceMinor: 0, currency: useSettings.getState().settings.defaultCurrency, purchased: today(),
        });
        set((s) => ({ items: [...s.items, item] }));
        return item.id;
      },

      loadSampleData: () => {
        // The sample's prices are written in dollars, so they're labelled USD whatever the default is:
        // "3.89" milk in rupees would be nonsense. The ledger converts them to the display currency.
        const sample = sampleData(SAMPLE_CURRENCY);
        set((s) => ({ items: [...s.items, ...sample.items], receipts: [...sample.receipts, ...s.receipts], events: [...sample.events, ...s.events] }));
      },
      clearAllData: () => {
        get().items.forEach((i) => deleteFoodPhoto(i.photoUri));
        set({ items: [], receipts: [], events: [], recentCurrencies: [], storeHints: {}, shopping: [], plan: [] });
      },
    }),
    {
      name: 'ghost-kitchen',
      version: APP_STORE_VERSION,
      storage: createJSONStorage(() => safeStorage('fridge')),
      // Only data. Settings are in their own store (settings-store.ts), which copied them out of here.
      partialize: ({ items, receipts, events, recentCurrencies, storeHints, shopping, plan }) => ({ items, receipts, events, recentCurrencies, storeHints, shopping, plan }),
      merge: (persisted, current) => {
        const { settings: _old, ...data } = (persisted ?? {}) as Partial<AppState> & { settings?: unknown };
        return { ...current, ...data };
      },
      migrate: (persisted, version) => migrateAppData(persisted, version) as unknown as AppState,
      // Old finished items (and their photos) go once no recent history needs them.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const { items, photos } = pruneFinished(state.items, state.events, today());
        if (items !== state.items) {
          photos.forEach(deleteFoodPhoto);
          useApp.setState({ items });
        }
      },
    }
  )
);

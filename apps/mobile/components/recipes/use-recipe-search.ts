import { api, ApiError, type RemoteRecipe } from '@/lib/api';
import { STAGE_META } from '@/lib/domain/catalog';
import type { Diet } from '@/lib/domain/diets';
import { isCookable, stageOf } from '@/lib/domain/expiry';
import type { Item } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { useServer } from '@/lib/store/server-store';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import * as React from 'react';
import type { ScrollView } from 'react-native';

/** Recipes per page. The server ranks the whole list once; each page is a stable slice of it. */
export const PAGE_SIZE = 10;

/** Urgency sent to the server: Fresh 1 … Rotting 4. Spoiled and unsafe food is never sent. */
const urgencyOf = (i: Item) => STAGE_META[stageOf(i)].weight;

export type Paging = { page: number; pages: number; total: number };
export type RecipeSearch =
  | { kind: 'idle' }
  /** `paging` is the page being left, so the pager stays put (disabled) while the next one loads. */
  | { kind: 'loading'; paging?: Paging }
  | { kind: 'done'; recipes: RemoteRecipe[]; warnings: string[]; paging: Paging }
  | { kind: 'error'; message: string; page: number };

/**
 * Talking to the recipe service: the first search (best matches), "Find again" (a fresh mix that leaves
 * out what you've already seen), and paging. Kept apart from the screen so the screen is only layout.
 */
export function useRecipeSearch(scrollRef: React.RefObject<ScrollView | null>) {
  const markUnreachable = useServer((s) => s.markUnreachable);
  const [state, setState] = React.useState<RecipeSearch>({ kind: 'idle' });
  const reqId = React.useRef(0);
  const stateRef = React.useRef(state);
  stateRef.current = state;
  /** 0 = best-first. "Find again" picks a new one; paging and diet changes keep it, so pages stay stable. */
  const seedRef = React.useRef(0);
  /** Recipes shown before each "Find again", so the next mix starts with ones not seen yet. */
  const seenRef = React.useRef<string[]>([]);

  /** Fetches one page (always from the server, so going back shows exactly that page's recipes again). */
  const load = React.useCallback(async (diets: Diet[], page = 1, opts: { fresh?: boolean; best?: boolean } = {}) => {
    if (opts.best) { seedRef.current = 0; seenRef.current = []; }
    const id = ++reqId.current;
    const prev = stateRef.current;
    const shown = prev.kind === 'done' ? prev.recipes.map((r) => r.id) : [];
    if (opts.fresh) {
      seedRef.current = 1 + Math.floor(Math.random() * 2_000_000_000);
      const total = prev.kind === 'done' ? prev.paging.total : 0;
      const seen = [...new Set([...seenRef.current, ...shown])];
      // Once (nearly) everything has been seen, start the rotation over instead of showing only repeats.
      seenRef.current = seen.length + PAGE_SIZE > total ? shown : seen.slice(-60);
    }
    setState({ kind: 'loading', paging: prev.kind === 'done' && page !== 1 ? prev.paging : undefined });
    if (page !== 1) scrollRef.current?.scrollTo({ y: 0, animated: false });
    const usable = useApp.getState().items.filter((i) => i.status === 'active' && isCookable(i));
    try {
      const res = await api.suggestRecipes({
        items: usable.map((i) => ({ id: i.id, name: i.name, unit: i.unit, urgency: urgencyOf(i) })),
        diets, limit: PAGE_SIZE, page, seed: seedRef.current, seen: seenRef.current, useAi: !useSettings.getState().settings.tesseractOnly,
      });
      if (id !== reqId.current) return;
      // The fridge may have changed since the last page (something cooked): stay within the real range.
      if (res.recipes.length === 0 && page > 1 && res.page.pages > 0) {
        void load(diets, res.page.pages);
        return;
      }
      setState({ kind: 'done', recipes: res.recipes, warnings: res.warnings, paging: { page: res.page.number, pages: res.page.pages, total: res.page.total } });
      if (opts.fresh) {
        const ids = res.recipes.map((r) => r.id);
        // With only a handful of matches, a reshuffle can't bring anything new; say so instead of looking stuck.
        const same = ids.length > 0 && ids.length === shown.length && ids.every((x) => shown.includes(x));
        toast(same ? 'These are all the good matches right now. Add groceries or change diets for more.' : 'New recipes found');
      }
    } catch (e) {
      if (id !== reqId.current) return;
      const err = e instanceof ApiError ? e : null;
      if (err?.code === 'offline') markUnreachable(err.message);
      setState({ kind: 'error', message: err?.message ?? 'Could not load recipes.', page });
    }
  }, [markUnreachable, scrollRef]);

  const reset = React.useCallback(() => setState({ kind: 'idle' }), []);
  return { state, load, reset };
}

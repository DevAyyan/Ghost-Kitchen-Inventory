import { today } from '@/lib/domain/dates';
import { stageOf } from '@/lib/domain/expiry';
import { learnFromHistory } from '@/lib/domain/learning';
import type { Item, Stage } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { useHousehold } from '@/lib/store/household-store';
import { useSettings } from '@/lib/store/settings-store';
import { useEffect, useMemo, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

/** Breakpoints from docs/design-contract.md. */
export function useLayout() {
  const { width } = useWindowDimensions();
  return {
    width,
    isPhone: width < 768,
    /** Persistent "Haunting now" side panel. */
    hasSidePanel: width >= 1280,
  };
}

/** What the learning loop knows from this household's history (recomputed when history changes). */
export function useLessons() {
  const events = useApp((s) => s.events);
  return useMemo(() => learnFromHistory(events, today()), [events]);
}

export function useActiveItems(): Item[] {
  return useApp(useShallow((s) => s.items.filter((i) => i.status === 'active')));
}

export function useStageCounts(items: Item[]): Record<Stage, number> {
  return useMemo(() => {
    const c: Record<Stage, number> = { fresh: 0, aging: 0, expiring: 0, rotting: 0, spoiled: 0 };
    for (const i of items) c[stageOf(i)]++;
    return c;
  }, [items]);
}

/**
 * True on web with a mouse or trackpad (a pointer that can hover precisely). False on Android, on phones
 * and tablets in a browser, and during the first render, so it matches the static HTML.
 */
export function useCanHover(): boolean {
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return canHover;
}

/** OS "reduce motion" or the in-app setting. */
export function useMotionAllowed(): boolean {
  const osReduced = useReducedMotion();
  const appReduced = useSettings((s) => s.settings.reduceMotion);
  return !osReduced && !appReduced;
}

/**
 * True once both saved stores (fridge data and settings) have loaded, so defaults never flash over saved
 * data and the server check uses the saved address. Starts false on every platform so the first client
 * render matches the static web HTML (web storage hydrates synchronously; reading it during render
 * caused a hydration mismatch).
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const done = () => setHydrated(useApp.persist.hasHydrated() && useSettings.persist.hasHydrated() && useHousehold.persist.hasHydrated());
    const offs = [useApp.persist.onFinishHydration(done), useSettings.persist.onFinishHydration(done), useHousehold.persist.onFinishHydration(done)];
    done();
    return () => offs.forEach((off) => off());
  }, []);
  return hydrated;
}

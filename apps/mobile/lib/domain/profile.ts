import type { ItemEvent } from './types';
import { addDays, weekStart } from './dates';

/**
 * Profiles: the ghost avatar, the preferences that follow a person between devices, and their own record
 * (food rescued and lost, badges). Pure, so it's tested; the server stores the profile (apps/api/src/profile.ts).
 */

export const AVATAR_COLOURS = ['mint', 'pumpkin', 'violet', 'bone', 'blood', 'moss', 'midnight'] as const;
export type AvatarColour = (typeof AVATAR_COLOURS)[number];
export interface Avatar { ghost: number; colour: AvatarColour }

/** Background behind the pixel ghost. Decorative: the name next to it says who it is. */
export const AVATAR_HEX: Record<AvatarColour, string> = {
  mint: '#2f9e72', pumpkin: '#c8641e', violet: '#7b52c7', bone: '#a89f86', blood: '#9e2b2b', moss: '#5b7a3a', midnight: '#2d3a6b',
};

/** Settings that follow you to every device you sign in on. The rest (server, notifications…) stay per device. */
export const SYNCED_PREFS = ['diets', 'displayCurrency', 'defaultCurrency', 'largeText', 'soundEffects', 'reduceMotion'] as const;
export type SyncedPref = (typeof SYNCED_PREFS)[number];
export type Prefs = Partial<Record<SyncedPref, unknown>>;

/** The synced part of the settings, to send up. */
export function pickPrefs(settings: Record<string, unknown>): Prefs {
  return Object.fromEntries(SYNCED_PREFS.filter((k) => k in settings).map((k) => [k, settings[k]]));
}

/** Whether the profile's preferences differ from this device's (so they need sending or applying). */
export function prefsDiffer(a: Prefs, b: Prefs): boolean {
  return SYNCED_PREFS.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

/**
 * History that counts as yours: entries you made, plus (when you aren't sharing a household) the ones from
 * before accounts, which can only have been made here.
 */
export function myEvents(events: ItemEvent[], userId: string | null, sharing: boolean): ItemEvent[] {
  if (!userId) return events;
  return events.filter((e) => e.by === userId || (!e.by && !sharing));
}

/** Food used while it was turning counts as rescued: a ghost banished. */
const rescued = (e: ItemEvent) => e.type === 'used' && e.stage !== 'fresh';

export interface PersonalStats {
  banished: number;
  /** Rescued and lost value, per currency (the screen converts for display). */
  saved: { minor: number; currency: string }[];
  lost: { minor: number; currency: string }[];
  buried: number;
  /** Food used before it spoiled, fresh or turning (First light). */
  usedBeforeSpoiling: number;
  /** Spoiled food thrown out (Gravedigger). */
  buriedSpoiled: number;
  /** Weeks in a row, up to this one, with food rescued and none thrown out. */
  streak: number;
}

export function personalStats(events: ItemEvent[], now: string): PersonalStats {
  const saved = events.filter(rescued);
  const thrown = events.filter((e) => e.type === 'discarded');
  return {
    banished: saved.length,
    saved: saved.map((e) => ({ minor: e.minor, currency: e.currency })),
    lost: thrown.map((e) => ({ minor: e.minor, currency: e.currency })),
    buried: thrown.length,
    usedBeforeSpoiling: events.filter((e) => e.type === 'used' && e.stage !== 'spoiled').length,
    buriedSpoiled: thrown.filter((e) => e.stage === 'spoiled').length,
    streak: cleanWeeks(events, now),
  };
}

/** Consecutive Monday–Sunday weeks, ending with the current one, that rescued food and binned none. */
function cleanWeeks(events: ItemEvent[], now: string): number {
  const weeks = new Map<string, { saved: number; thrown: number }>();
  for (const e of events) {
    const w = weekStart(e.date);
    const v = weeks.get(w) ?? { saved: 0, thrown: 0 };
    if (rescued(e)) v.saved++;
    if (e.type === 'discarded') v.thrown++;
    weeks.set(w, v);
  }
  let streak = 0;
  // This week may still be going: it only breaks the streak once something is thrown out.
  let w = weekStart(now);
  const cur = weeks.get(w);
  if (cur && cur.thrown === 0 && cur.saved > 0) streak++;
  else if (cur && cur.thrown > 0) return 0;
  for (let i = 0; i < 520; i++) {
    w = shiftWeek(w, -1);
    const v = weeks.get(w);
    if (!v || v.saved === 0 || v.thrown > 0) break;
    streak++;
  }
  return streak;
}

const shiftWeek = (monday: string, by: number) => addDays(monday, 7 * by);

export type BadgeId = 'first-rescue' | 'exorcist' | 'ghostbuster' | 'clean-week' | 'clean-month' | 'gravedigger';

export interface Badge {
  id: BadgeId;
  title: string;
  /** What earns it, said plainly. */
  how: string;
  /** Pixel art (components/halloween/art.tsx). */
  art: 'candle' | 'ghost' | 'trophy' | 'moon' | 'crystalBall' | 'headstone';
  earned: boolean;
  /** Progress toward it, e.g. 7 of 10. */
  progress: { have: number; need: number };
}

/** Badges for food saved. Burying food never earns anything except the one for facing up to it. */
export function badges(s: PersonalStats): Badge[] {
  const b = (id: BadgeId, title: string, how: string, art: Badge['art'], have: number, need: number): Badge =>
    ({ id, title, how, art, earned: have >= need, progress: { have: Math.min(have, need), need } });
  return [
    b('first-rescue', 'First light', 'Use something before it spoils', 'candle', s.usedBeforeSpoiling, 1),
    b('exorcist', 'Exorcist', 'Banish 10 ghosts', 'ghost', s.banished, 10),
    b('ghostbuster', 'Ghostbuster', 'Banish 50 ghosts', 'trophy', s.banished, 50),
    b('clean-week', 'Quiet night', 'A week with food rescued and none thrown out', 'moon', s.streak, 1),
    b('clean-month', 'Calm house', '4 quiet weeks in a row', 'crystalBall', s.streak, 4),
    // Clearing out spoiled food is the right call, so it gets one badge.
    b('gravedigger', 'Gravedigger', 'Bury spoiled food instead of keeping it', 'headstone', s.buriedSpoiled, 1),
  ];
}

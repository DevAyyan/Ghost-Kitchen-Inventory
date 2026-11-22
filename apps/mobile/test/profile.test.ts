import { describe, expect, it } from 'vitest';
import { addDays, weekStart } from '@/lib/domain/dates';
import { badges, myEvents, personalStats, pickPrefs, prefsDiffer } from '@/lib/domain/profile';
import type { ItemEvent } from '@/lib/domain/types';

const NOW = '2026-11-19'; // a Thursday
const ev = (over: Partial<ItemEvent>): ItemEvent => ({
  id: Math.random().toString(36).slice(2), type: 'used', name: 'Milk', category: 'dairy', minor: 100, currency: 'EUR',
  stage: 'expiring', date: NOW, ...over,
});

describe('whose history', () => {
  const mine = ev({ by: 'user_me' });
  const theirs = ev({ by: 'user_sam' });
  const old = ev({});
  it('counts only my entries when sharing, and older unattributed ones when not', () => {
    expect(myEvents([mine, theirs, old], 'user_me', true)).toEqual([mine]);
    expect(myEvents([mine, theirs, old], 'user_me', false)).toEqual([mine, old]);
    expect(myEvents([mine, theirs, old], null, true)).toHaveLength(3);
  });
});

describe('personal stats', () => {
  it('counts food used while turning as banished, never fresh food', () => {
    const s = personalStats([ev({}), ev({ stage: 'fresh' }), ev({ type: 'discarded', stage: 'spoiled' })], NOW);
    expect(s.banished).toBe(1);
    expect(s.buried).toBe(1);
    expect(s.saved).toEqual([{ minor: 100, currency: 'EUR' }]);
  });

  it('counts quiet weeks in a row, ending this week, and breaks on anything thrown out', () => {
    const thisWeek = weekStart(NOW);
    const week = (n: number) => addDays(thisWeek, -7 * n);
    const quiet = [ev({ date: NOW }), ev({ date: week(1) }), ev({ date: week(2) })];
    expect(personalStats(quiet, NOW).streak).toBe(3);
    // A week with nothing rescued ends it.
    expect(personalStats([ev({ date: NOW }), ev({ date: week(2) })], NOW).streak).toBe(1);
    // Binning something this week ends it straight away.
    expect(personalStats([...quiet, ev({ type: 'discarded', date: NOW })], NOW).streak).toBe(0);
    // This week can still be empty without breaking last week's run.
    expect(personalStats([ev({ date: week(1) }), ev({ date: week(2) })], NOW).streak).toBe(2);
  });
});

describe('badges', () => {
  it('earns food-saving badges by count, and shows progress toward the rest', () => {
    const many = Array.from({ length: 12 }, () => ev({}));
    const list = badges(personalStats(many, NOW));
    const by = Object.fromEntries(list.map((b) => [b.id, b]));
    expect(by['first-rescue']!.earned).toBe(true);
    expect(by.exorcist!.earned).toBe(true);
    expect(by.ghostbuster!.earned).toBe(false);
    expect(by.ghostbuster!.progress).toEqual({ have: 12, need: 50 });
    expect(by['clean-week']!.earned).toBe(true);
  });

  it('gives nothing for an empty history', () => {
    expect(badges(personalStats([], NOW)).some((b) => b.earned)).toBe(false);
  });
});

describe('preferences that follow you', () => {
  const settings = { diets: ['vegan'], displayCurrency: 'EUR', defaultCurrency: 'EUR', largeText: true, soundEffects: false, reduceMotion: false, apiUrl: 'https://x', notifyDigest: true };
  it('picks only the synced ones; the server address and notifications stay on the device', () => {
    expect(pickPrefs(settings)).toEqual({ diets: ['vegan'], displayCurrency: 'EUR', defaultCurrency: 'EUR', largeText: true, soundEffects: false, reduceMotion: false });
  });
  it('notices a difference in any synced preference, including diets', () => {
    expect(prefsDiffer(pickPrefs(settings), pickPrefs(settings))).toBe(false);
    expect(prefsDiffer(pickPrefs(settings), { ...pickPrefs(settings), diets: ['vegan', 'halal'] })).toBe(true);
  });
});

/**
 * Badges on the ledger and profile (apps/mobile/lib/domain/profile.ts). Each one must be earned exactly the
 * way its description says, and throwing food out must never count as saving it.
 */
import { describe, expect, it } from 'vitest';
import { badges, myEvents, personalStats } from '../../mobile/lib/domain/profile.js';
import type { ItemEvent } from '../../mobile/lib/domain/types.js';

// Monday 23 November 2026.
const NOW = '2026-11-23';
let n = 0;
const ev = (type: ItemEvent['type'], stage: ItemEvent['stage'], date = NOW, by?: string): ItemEvent => ({
  id: `e${n++}`, type, stage, date, name: 'Spinach', category: 'vegetable', minor: 100, currency: 'USD',
  amount: 1, unit: 'pcs', ...(by ? { by } : {}),
});
const earned = (events: ItemEvent[]) =>
  Object.fromEntries(badges(personalStats(events, NOW)).map((b) => [b.id, b.earned ? true : `${b.progress.have}/${b.progress.need}`]));

describe('badges', () => {
  it('starts with none earned', () => {
    expect(Object.values(earned([])).every((v) => v !== true)).toBe(true);
  });

  it('First light: using any food before it spoils, fresh included', () => {
    expect(earned([ev('used', 'fresh')])['first-rescue']).toBe(true);
    expect(earned([ev('used', 'expiring')])['first-rescue']).toBe(true);
    expect(earned([ev('used', 'spoiled')])['first-rescue']).toBe('0/1');
  });

  it('Exorcist and Ghostbuster count only food used while it was turning', () => {
    const turning = Array.from({ length: 10 }, () => ev('used', 'aging'));
    expect(earned(turning).exorcist).toBe(true);
    expect(earned(turning).ghostbuster).toBe('10/50');
    expect(earned(Array.from({ length: 10 }, () => ev('used', 'fresh'))).exorcist).toBe('0/10');
  });

  it('Gravedigger: only for throwing out spoiled food', () => {
    expect(earned([ev('discarded', 'spoiled')]).gravedigger).toBe(true);
    expect(earned([ev('discarded', 'fresh')]).gravedigger).toBe('0/1');
    expect(earned([ev('discarded', 'rotting')]).gravedigger).toBe('0/1');
  });

  it('Throwing food out never earns a saving badge', () => {
    const b = earned([ev('discarded', 'fresh'), ev('discarded', 'expiring')]);
    expect([b['first-rescue'], b.exorcist, b['clean-week']]).toEqual(['0/1', '0/10', '0/1']);
  });

  it('Quiet night and Calm house: weeks in a row with food rescued and none thrown out', () => {
    const weeks = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'].map((d) => ev('used', 'aging', d));
    expect(earned(weeks)['clean-week']).toBe(true);
    expect(earned(weeks)['clean-month']).toBe(true);
    // Something thrown out this week breaks the run.
    expect(earned([...weeks, ev('discarded', 'spoiled', NOW)])['clean-month']).toBe('0/4');
    // A week that has only just started doesn't break it.
    const lastFour = ['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map((d) => ev('used', 'aging', d));
    expect(earned(lastFour)['clean-month']).toBe(true);
  });

  it('counts only your own food in a shared kitchen', () => {
    const events = [ev('used', 'aging', NOW, 'me'), ev('used', 'aging', NOW, 'housemate'), ev('used', 'aging', NOW)];
    expect(myEvents(events, 'me', true)).toHaveLength(1);
    expect(myEvents(events, 'me', false)).toHaveLength(2);
  });
});

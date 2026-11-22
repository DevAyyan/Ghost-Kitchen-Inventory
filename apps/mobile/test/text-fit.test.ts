import { describe, expect, it } from 'vitest';
import { fitLabel, FONT_EM } from '@/lib/text-fit';

describe('fitting names into narrow boxes', () => {
  // A phone tile is 56 px wide; its text has 44 px (measured in the browser).
  it('keeps the biggest size when every word fits', () => {
    expect(fitLabel('Eggs', 44, FONT_EM.pixel, [15, 13, 12])).toEqual({ size: 15, text: 'Eggs', lines: 1 });
    expect(fitLabel('Bell pepper', 44, FONT_EM.pixel, [15, 13, 12])).toMatchObject({ size: 15, lines: 2 });
  });

  it('steps down a size before breaking a word', () => {
    // "Cilantro": 8 × 15 × 0.4 = 48 is too wide; 8 × 13 × 0.4 = 41.6 fits. "Mushrooms" needs 12 px.
    expect(fitLabel('Cilantro', 44, FONT_EM.pixel, [15, 13, 12])).toEqual({ size: 13, text: 'Cilantro', lines: 1 });
    expect(fitLabel('Mushrooms', 44, FONT_EM.pixel, [15, 13, 12])).toEqual({ size: 12, text: 'Mushrooms', lines: 1 });
  });

  it('hyphenates a word that no size fits, never mid-letter-pair at random', () => {
    const f = fitLabel('Strawberries', 44, FONT_EM.pixel, [15, 13, 12]);
    expect(f.size).toBe(12);
    const [first, second] = f.text.split('\n');
    expect(first!.endsWith('-')).toBe(true);
    expect(first!.length).toBeLessThanOrEqual(9);
    expect(second!.length).toBeGreaterThanOrEqual(3);
    expect(f.text.replace('-\n', '')).toBe('Strawberries');
    expect(f.text).toBe('Strawber-\nries');
    expect(fitLabel('Mushrooms', 42, FONT_EM.pixel, [15, 13, 12]).text).toBe('Mush-\nrooms');
  });

  it('sizes tombstone names so "Lettuce" and "Sourdough" stay whole', () => {
    // Phone stone: 112 px wide less padding and border = 84 px of room.
    for (const name of ['Lettuce', 'Sourdough', 'Salmon fillet']) {
      const f = fitLabel(name, 84, FONT_EM.display, [23, 20, 18, 16, 14]);
      expect(f.text).toBe(name);
      expect(Math.max(...name.split(' ').map((w) => w.length)) * f.size * FONT_EM.display).toBeLessThanOrEqual(84);
    }
  });
});

import { tileDateText } from '@/lib/domain/expiry';
import { fitOneLine } from '@/lib/text-fit';

describe('food tile date line', () => {
  it('marks every estimate "est." and never says food past its date is fine', () => {
    for (const rem of [150, 12, 5, 1, 0, -1, -4]) {
      expect(tileDateText(rem, false)).toMatch(/ est\.$/);
      expect(tileDateText(rem, true)).not.toMatch(/est|ok|fine|safe/i);
    }
    expect(tileDateText(5, true)).toBe('5d left');
    expect(tileDateText(5, false)).toBe('5d est.');
    expect(tileDateText(150, false)).toBe('5mo est.');
    expect(tileDateText(-2, false)).toBe('2d over est.');
  });
  it('fits on one line of a phone tile, shrinking a step only when it must', () => {
    const room = 56 - 10;
    expect(fitOneLine('5d left', room, FONT_EM.pixel, [13, 12, 11])).toBe(13);
    for (const rem of [150, 99, 12, 5, 0, -12]) {
      const t = tileDateText(rem, false);
      const s = fitOneLine(t, room, FONT_EM.pixel, [13, 12, 11]);
      expect(t.length * s * FONT_EM.pixel <= room || s === 11).toBe(true);
    }
  });
});

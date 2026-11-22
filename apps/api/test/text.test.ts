import { describe, expect, it } from 'vitest';
import { fixMojibake, fixMojibakeDeep } from '../src/text.js';

describe('fixMojibake', () => {
  it('repairs UTF-8 read as Windows-1252', () => {
    expect(fixMojibake('SautÃ© the spinach')).toBe('Sauté the spinach');
    expect(fixMojibake('itâ€™s done â€” serve')).toBe('it’s done — serve');
    expect(fixMojibake('JalapeÃ±o crÃ¨me fraÃ®che')).toBe('Jalapeño crème fraîche');
  });

  it('leaves real accented text alone', () => {
    for (const s of ['Sauté', 'crème brûlée', 'Ångström', '£4.50 · 2 × 100 g', 'Ãngel']) expect(fixMojibake(s)).toBe(s);
  });

  it('drops stray control characters left by a broken sequence', () => {
    expect(fixMojibake('Saut\u0099 x')).toBe('Saut x');
  });

  it('repairs every string in a parsed response', () => {
    expect(fixMojibakeDeep({ title: 'CafÃ©', steps: ['Stir â€“ gently'], n: 2 })).toEqual({ title: 'Café', steps: ['Stir – gently'], n: 2 });
  });
});

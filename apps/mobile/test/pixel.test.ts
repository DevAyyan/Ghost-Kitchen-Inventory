import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { banded } from '@/lib/banded';
import { largerText } from '@/lib/text-scale';
import { addDays } from '@/lib/domain/dates';
import { makeItem } from '@/lib/domain/expiry';
import { AJAR_FRAME, ajarOf, changedZones, GAPS, GHOST_PX, restFrame, sceneZones, SPRITE_H, SPRITE_W } from '@/lib/domain/kitchen-scene';
import type { Item, Zone } from '@/lib/domain/types';

const NOW = '2026-11-17';
const food = (zone: Zone, daysLeft: number, category: Item['category'] = 'vegetable'): Item => ({
  ...makeItem({ name: `${zone} ${daysLeft}`, category, priceMinor: 100, currency: 'EUR', purchased: addDays(NOW, -10), zone }),
  zone,
  expires: addDays(NOW, daysLeft),
  shelfDays: 20,
});

describe('banded gradients', () => {
  it('turns smooth stops into hard bands', () => {
    const b = banded(['hsl(0, 0%, 0%)', 'hsl(0, 0%, 100%)'])!;
    expect(b.colors).toHaveLength(12);
    // Each band is one flat colour: it starts and ends on the same value.
    for (let i = 0; i < b.colors.length; i += 2) expect(b.colors[i]).toBe(b.colors[i + 1]);
    expect(b.locations[0]).toBe(0);
    expect(b.locations.at(-1)).toBe(1);
    // Lightness steps up from band to band.
    const light = b.colors.filter((_, i) => i % 2 === 0).map((c) => Number(/,\s*([\d.]+)%,\s*[\d.]+\)$/.exec(c)![1]));
    expect([...light].sort((x, y) => x - y)).toEqual(light);
  });

  it('passes colours it cannot read through untouched', () => {
    expect(banded(['#000', '#fff'])).toBeNull();
  });
});

describe('kitchen doors', () => {
  it('stand ajar only where something is expiring, rotting or spoiled', () => {
    const items = [food('fridge', 1), food('pantry', 30), food('freezer', -2)];
    const zones = sceneZones(items, items, NOW);
    expect(ajarOf(zones)).toEqual({ fridge: true, pantry: false, freezer: true });
    expect(zones.fridge.haunting).toBe(1);
    expect(zones.pantry.haunting).toBe(0);
  });

  it('count every stored item for the ajar state, not just what a search shows', () => {
    const all = [food('fridge', 1), food('fridge', 30)];
    const shown = [all[1]];
    const zones = sceneZones(shown, all, NOW);
    expect(zones.fridge.count).toBe(1);
    expect(ajarOf(zones).fridge).toBe(true);
  });

  it('say in words what is inside', () => {
    const zones = sceneZones([], [food('fridge', 1)], NOW);
    expect(zones.fridge.label).toMatch(/^Fridge door, closed\. 1 item: 1 expiring\. Open it\.$/);
    expect(zones.pantry.label).toBe('Pantry door, closed. Empty. Open it.');
  });

  it('rest on the ajar frame only when ajar', () => {
    const ajar = { fridge: true, freezer: false, pantry: false };
    expect(restFrame('fridge', ajar)).toBe(AJAR_FRAME);
    expect(restFrame('freezer', ajar)).toBe(0);
  });

  it('keep the peeking ghost window inside its sprite and as tall as a ghost', () => {
    for (const g of Object.values(GAPS)) {
      expect(g.x).toBeGreaterThanOrEqual(0);
      expect(g.x + g.w).toBeLessThanOrEqual(SPRITE_W);
      expect(g.y + g.h).toBeLessThanOrEqual(SPRITE_H);
      expect(g.h).toBeGreaterThanOrEqual(GHOST_PX);
    }
  });
});

/** PNG width and height, from the IHDR chunk. */
function pngSize(path: string) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe('generated sprites', () => {
  const kitchen = 'assets/sprites/kitchen';
  it('has every frame the scene loads, all on the same 4x canvas', () => {
    const names = ['both-ajar'];
    for (const z of ['fridge', 'freezer', 'pantry']) {
      names.push(`${z}-0`, `${z}-ajar`, `${z}-1`, `${z}-2`, `${z}-3`, `${z}-4`);
      // The haunted light for every frame but shut, so it stays on through the swing.
      for (let f = 1; f <= 5; f++) names.push(`light-${z}-${f}`);
    }
    for (const n of names) {
      const path = `${kitchen}/${n}.png`;
      expect(existsSync(path), path).toBe(true);
      expect(pngSize(path), path).toEqual({ w: SPRITE_W * 4, h: SPRITE_H * 4 });
    }
  });

  it('has square ghost sprites', () => {
    for (let i = 0; i < 5; i++) {
      const { w, h } = pngSize(`assets/sprites/ghosts/ghost-${i}.png`);
      expect(w).toBe(h);
    }
  });
});

describe('larger text', () => {
  it('moves every size one step up, keeps other classes, and frees fixed line heights', () => {
    expect(largerText('font-pixel text-xs text-muted-foreground')).toBe('font-pixel text-sm text-muted-foreground');
    expect(largerText('text-base md:text-2xl')).toBe('text-lg md:text-3xl');
    expect(largerText('text-[13px] leading-3.5 tabular-nums')).toBe('text-[15px] tabular-nums');
    expect(largerText('text-4xl')).toBe('text-4xl');
  });
});

describe('a housemate\'s change', () => {
  it('names the sections whose food changed', () => {
    const milk = food('fridge', 5);
    const peas = food('freezer', 60);
    const rice = food('pantry', 200);
    expect(changedZones([milk, peas], [milk, peas])).toEqual([]);
    expect(changedZones([milk], [milk, rice])).toEqual(['pantry']);
    expect(changedZones([milk, peas], [peas])).toEqual(['fridge']);
    expect(changedZones([milk], [{ ...milk, zone: 'freezer' }])).toEqual(['freezer', 'fridge']);
    expect(changedZones([milk], [{ ...milk, status: 'used' }])).toEqual(['fridge']);
  });
});

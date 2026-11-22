import { crisp } from '@/components/fridge/pixel-effects';
import type { Stage } from '@/lib/domain/types';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

/**
 * The five stage icons drawn for small places (the corner badge on food tiles): 8 × 8 pixel art shown at
 * 16 px, so every art pixel is exactly 2 screen pixels and stays sharp. Same shapes as the bigger icons:
 * sprout (fresh), hourglass (aging), flame (expiring), bug (rotting), ghost (spoiled).
 */
const GLYPHS: Record<Stage, string[]> = {
  fresh: [
    '##....##',
    '###..###',
    '.##..##.',
    '..####..',
    '...##...',
    '...##...',
    '..####..',
    '.######.',
  ],
  aging: [
    '########',
    '.#....#.',
    '..#..#..',
    '...##...',
    '...##...',
    '..#..#..',
    '.######.',
    '########',
  ],
  expiring: [
    '...#....',
    '...##...',
    '..###.#.',
    '.#####..',
    '.##.###.',
    '##...###',
    '##...###',
    '.######.',
  ],
  rotting: [
    '.#....#.',
    '..#..#..',
    '#.####.#',
    '.######.',
    '#.####.#',
    '.######.',
    '#.####.#',
    '..#..#..',
  ],
  spoiled: [
    '..####..',
    '.######.',
    '##.##.##',
    '########',
    '########',
    '########',
    '########',
    '#.#.#.#.',
  ],
};

export function StageGlyph({ stage, size = 16, color }: { stage: Stage; size?: number; color: string }) {
  const rows = GLYPHS[stage];
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 8 8" {...crisp}>
        {rows.flatMap((row, y) =>
          [...row].map((ch, x) => (ch === '#' ? <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} /> : null)),
        )}
      </Svg>
    </View>
  );
}

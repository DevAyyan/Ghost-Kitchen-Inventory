import { cauldron, pumpkin, spiderWeb } from '@lucide/lab';
import { createLucideIcon } from 'lucide-react-native';

// Lucide Lab (ISC) icons, built into regular Lucide components so <Icon as={…}> treats them like the rest.
/** "Haunting": expiring, rotting and spoiled together. Kept apart from Flame, which means expiring only. */
export const Pumpkin = createLucideIcon('pumpkin', pumpkin);
export const Cauldron = createLucideIcon('cauldron', cauldron);
export const SpiderWeb = createLucideIcon('spider-web', spiderWeb);
/**
 * Forgotten food, matching the dust settled on forgotten tiles. Drawn as pixel art by Icon (pixel-icons.ts);
 * these circles are only the Lucide fallback.
 */
export const Dust = createLucideIcon('dust', [
  ['circle', { cx: '5', cy: '7', r: '1', key: 'd1' }], ['circle', { cx: '12', cy: '5', r: '1', key: 'd2' }],
  ['circle', { cx: '18', cy: '9', r: '1', key: 'd3' }], ['circle', { cx: '8', cy: '13', r: '1', key: 'd4' }],
  ['circle', { cx: '15', cy: '15', r: '1', key: 'd5' }], ['path', { d: 'M3 20h18', key: 'd6' }],
]);

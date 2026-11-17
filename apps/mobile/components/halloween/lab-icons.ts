import { cauldron, pumpkin, spiderWeb } from '@lucide/lab';
import { createLucideIcon } from 'lucide-react-native';

// Lucide Lab (ISC) icons, built into regular Lucide components so <Icon as={…}> treats them like the rest.
/** "Haunting": expiring, rotting and spoiled together. Kept apart from Flame, which means expiring only. */
export const Pumpkin = createLucideIcon('pumpkin', pumpkin);
export const Cauldron = createLucideIcon('cauldron', cauldron);
/** Forgotten food, matching the cobweb drawn on forgotten tiles and doors. */
export const SpiderWeb = createLucideIcon('spider-web', spiderWeb);

/**
 * Pixel-art ghosts (from ~/Downloads/Ghosts), cropped to their 24 px cells and pre-scaled 4x with
 * nearest-neighbour so they stay crisp. Each spoiled item gets one, picked from its id so it keeps it.
 */
export const GHOSTS = [
  require('@/assets/sprites/ghosts/ghost-0.png'),
  require('@/assets/sprites/ghosts/ghost-1.png'),
  require('@/assets/sprites/ghosts/ghost-2.png'),
  require('@/assets/sprites/ghosts/ghost-3.png'),
  require('@/assets/sprites/ghosts/ghost-4.png'),
] as const;

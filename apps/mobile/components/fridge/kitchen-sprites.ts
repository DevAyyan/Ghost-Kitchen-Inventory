import type { Zone } from '@/lib/domain/types';

/**
 * Pixel-art door animation, graded by scripts/spookify-sprites.py: index 0 shut, 1 ajar (a thin crack, made by
 * the script: the rest pose of a door with food turning behind it), then the pack's frames 1 to 4 out to fully
 * open. Pre-scaled 4x with nearest-neighbour so Android's smoothing at display size stays crisp. Metro needs
 * literal require() paths.
 */
export const SPRITES: Record<Zone, number[]> = {
  freezer: [
    require('@/assets/sprites/kitchen/freezer-0.png'), require('@/assets/sprites/kitchen/freezer-ajar.png'),
    require('@/assets/sprites/kitchen/freezer-1.png'),
    require('@/assets/sprites/kitchen/freezer-2.png'), require('@/assets/sprites/kitchen/freezer-3.png'),
    require('@/assets/sprites/kitchen/freezer-4.png'),
  ],
  fridge: [
    require('@/assets/sprites/kitchen/fridge-0.png'), require('@/assets/sprites/kitchen/fridge-ajar.png'),
    require('@/assets/sprites/kitchen/fridge-1.png'),
    require('@/assets/sprites/kitchen/fridge-2.png'), require('@/assets/sprites/kitchen/fridge-3.png'),
    require('@/assets/sprites/kitchen/fridge-4.png'),
  ],
  pantry: [
    require('@/assets/sprites/kitchen/pantry-0.png'), require('@/assets/sprites/kitchen/pantry-ajar.png'),
    require('@/assets/sprites/kitchen/pantry-1.png'),
    require('@/assets/sprites/kitchen/pantry-2.png'), require('@/assets/sprites/kitchen/pantry-3.png'),
    require('@/assets/sprites/kitchen/pantry-4.png'),
  ],
};

/** Freezer and fridge doors both ajar (scripts/make-pixel-assets.py). */
export const BOTH_AJAR = require('@/assets/sprites/kitchen/both-ajar.png');

/** A slime drop falling from the freezer seam, four frames (scripts/make-pixel-assets.py). */
export const DRIPS = [
  require('@/assets/sprites/kitchen/drip-0.png'), require('@/assets/sprites/kitchen/drip-1.png'),
  require('@/assets/sprites/kitchen/drip-2.png'), require('@/assets/sprites/kitchen/drip-3.png'),
];

/** Each section's swung-open door, and its haunted light, cut from the fully open frame. */
export const OPEN_DOORS: Record<Zone, { door: number; light: number; aspect: number }> = {
  freezer: { door: require('@/assets/sprites/kitchen/door-freezer.png'), light: require('@/assets/sprites/kitchen/door-light-freezer.png'), aspect: 34 / 30 },
  fridge: { door: require('@/assets/sprites/kitchen/door-fridge.png'), light: require('@/assets/sprites/kitchen/door-light-fridge.png'), aspect: 37 / 43 },
  pantry: { door: require('@/assets/sprites/kitchen/door-pantry.png'), light: require('@/assets/sprites/kitchen/door-light-pantry.png'), aspect: 34 / 72 },
};

/** Red eyes in the dark crack of an ajar pantry. */
export const PANTRY_EYES = require('@/assets/sprites/kitchen/eyes-pantry.png');

/**
 * The ghostly light from a haunted door, per frame of SPRITES (index 0, shut, has none): through the crack
 * when ajar, then out of the opening as the door swings. Same canvas as the sprite.
 */
export const LIGHTS: Record<Zone, (number | null)[]> = {
  freezer: [
    null, require('@/assets/sprites/kitchen/light-freezer-1.png'), require('@/assets/sprites/kitchen/light-freezer-2.png'),
    require('@/assets/sprites/kitchen/light-freezer-3.png'), require('@/assets/sprites/kitchen/light-freezer-4.png'),
    require('@/assets/sprites/kitchen/light-freezer-5.png'),
  ],
  fridge: [
    null, require('@/assets/sprites/kitchen/light-fridge-1.png'), require('@/assets/sprites/kitchen/light-fridge-2.png'),
    require('@/assets/sprites/kitchen/light-fridge-3.png'), require('@/assets/sprites/kitchen/light-fridge-4.png'),
    require('@/assets/sprites/kitchen/light-fridge-5.png'),
  ],
  pantry: [
    null, require('@/assets/sprites/kitchen/light-pantry-1.png'), require('@/assets/sprites/kitchen/light-pantry-2.png'),
    require('@/assets/sprites/kitchen/light-pantry-3.png'), require('@/assets/sprites/kitchen/light-pantry-4.png'),
    require('@/assets/sprites/kitchen/light-pantry-5.png'),
  ],
};

import { DarkTheme, type Theme } from 'expo-router/react-navigation';

/** JS mirror of global.css, for places that need raw colours (navigation, status bar, SVG). */
export const COLORS = {
  background: 'hsl(268 20% 7%)',
  foreground: 'hsl(270 20% 95%)',
  card: 'hsl(268 18% 10%)',
  muted: 'hsl(268 14% 14%)',
  mutedForeground: 'hsl(268 10% 70%)',
  primary: 'hsl(155 87% 59%)',
  primaryForeground: 'hsl(268 30% 8%)',
  border: 'hsl(268 12% 21%)',
  destructive: 'hsl(2 82% 66%)',
  warning: 'hsl(45 100% 66%)',
  stage: {
    fresh: 'hsl(158 58% 52%)',
    aging: 'hsl(70 66% 56%)',
    expiring: 'hsl(24 95% 60%)',
    rotting: 'hsl(272 77% 72%)',
    spoiled: 'hsl(265 8% 66%)',
  },
} as const;

type Stops = readonly [string, string, ...string[]];

/**
 * Texture palette for the fridge and pantry illustrations (gradients can't use Tailwind tokens).
 * Comma-form hsl/hsla so every React Native and browser colour parser accepts it.
 */
export const MATERIALS = {
  /** The bar of an open fridge or freezer's lamp. */
  lamp: 'hsla(190, 90%, 94%, 0.95)',
  // Mould on food tiles uses the aging (olive) and rotting (violet) stage hues, so decay stays inside the
  // freshness colour system.
  mould: ['hsla(70, 45%, 52%, 0.85)', 'hsla(272, 45%, 62%, 0.75)', 'hsla(90, 22%, 40%, 0.85)'] as const,

  // Graveyard scene.
  night: ['hsl(270, 32%, 14%)', 'hsl(269, 24%, 9%)', 'hsl(268, 20%, 7%)'] as Stops,
  moonGlow: 'hsla(48, 60%, 88%, 0.10)',
  stone: ['hsl(220, 8%, 46%)', 'hsl(220, 9%, 32%)', 'hsl(222, 10%, 24%)'] as Stops,
  stoneEdge: 'hsl(222, 12%, 18%)',
  stoneText: 'hsl(220, 14%, 90%)',
  earth: ['hsl(24, 22%, 16%)', 'hsl(24, 20%, 9%)'] as Stops,
  /** Mist rising off the ground: clear at the top so it has no hard edge across the stones. */
  fog: ['hsla(220, 30%, 85%, 0)', 'hsla(220, 30%, 85%, 0.05)', 'hsla(220, 30%, 85%, 0.12)'] as Stops,
} as const;

/**
 * Flat colours sampled from the kitchen sprites after their spooky grade (scripts/spookify-sprites.py), so an
 * open compartment looks like the door you just zoomed into. Pixel art has no gradients: each part is one
 * colour with a darker edge. `text` sits on `body`, `insideText` on `inside`; both clear 4.5:1.
 */
export const PIXEL = {
  outline: '#1f221d',
  fridge: { body: '#788472', edge: '#535b4f', inside: '#536e6e', shelf: '#425050', shelfTop: '#5b7b7b', text: '#0f110e', insideText: '#e6ece6' },
  freezer: { body: '#788472', edge: '#535b4f', inside: '#556767', shelf: '#3c4848', shelfTop: '#618585', text: '#0f110e', insideText: '#e6ece6' },
  pantry: { body: '#3b2f27', edge: '#241c18', inside: '#2f251f', shelf: '#56473a', shelfTop: '#735e45', text: '#f0f0e6', insideText: '#f0f0e6' },
} as const;

export const NAV_THEME: Theme = {
  ...DarkTheme,
  colors: {
    background: COLORS.background,
    border: COLORS.border,
    card: COLORS.card,
    notification: COLORS.destructive,
    primary: COLORS.primary,
    text: COLORS.foreground,
  },
};

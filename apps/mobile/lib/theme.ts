import { DarkTheme, type Theme } from 'expo-router/react-navigation';

/** JS mirror of global.css, for places that need raw colours (navigation, status bar, SVG). */
export const COLORS = {
  background: 'hsl(228 22% 7%)',
  foreground: 'hsl(225 25% 94%)',
  card: 'hsl(228 20% 10%)',
  muted: 'hsl(228 16% 14%)',
  mutedForeground: 'hsl(226 14% 68%)',
  primary: 'hsl(160 64% 52%)',
  primaryForeground: 'hsl(228 30% 8%)',
  border: 'hsl(228 14% 20%)',
  destructive: 'hsl(0 72% 62%)',
  warning: 'hsl(40 92% 62%)',
  stage: {
    fresh: 'hsl(142 62% 56%)',
    aging: 'hsl(72 62% 56%)',
    expiring: 'hsl(28 95% 60%)',
    rotting: 'hsl(275 62% 72%)',
    spoiled: 'hsl(215 10% 66%)',
  },
} as const;

type Stops = readonly [string, string, ...string[]];

/**
 * Texture palette for the fridge and pantry illustrations (gradients can't use Tailwind tokens).
 * Comma-form hsl/hsla so every React Native and browser colour parser accepts it.
 */
export const MATERIALS = {
  steel: ['hsl(214, 10%, 66%)', 'hsl(214, 9%, 48%)', 'hsl(214, 10%, 36%)'] as Stops,
  steelBar: ['hsl(214, 14%, 82%)', 'hsl(214, 10%, 52%)'] as Stops,
  handle: ['hsl(214, 10%, 40%)', 'hsl(214, 16%, 86%)', 'hsl(214, 10%, 44%)'] as Stops,
  gasket: 'hsl(220, 14%, 8%)',
  fridgeInside: ['hsl(196, 28%, 30%)', 'hsl(214, 24%, 16%)', 'hsl(220, 24%, 11%)'] as Stops,
  freezerInside: ['hsl(200, 44%, 42%)', 'hsl(206, 36%, 24%)', 'hsl(212, 30%, 16%)'] as Stops,
  lamp: 'hsla(190, 90%, 94%, 0.95)',
  lampGlow: ['hsla(190, 80%, 92%, 0.28)', 'hsla(190, 80%, 92%, 0)'] as Stops,
  glass: ['hsla(190, 70%, 92%, 0.6)', 'hsla(190, 40%, 62%, 0.28)'] as Stops,
  frost: ['hsla(200, 80%, 96%, 0.75)', 'hsla(200, 50%, 70%, 0.35)'] as Stops,
  shelfShadow: ['hsla(0, 0%, 0%, 0.4)', 'hsla(0, 0%, 0%, 0)'] as Stops,
  woodFrame: ['hsl(26, 34%, 30%)', 'hsl(24, 32%, 21%)'] as Stops,
  woodPlank: ['hsl(30, 40%, 40%)', 'hsl(27, 38%, 31%)', 'hsl(25, 36%, 24%)'] as Stops,
  woodBack: ['hsl(24, 28%, 15%)', 'hsl(22, 26%, 10%)'] as Stops,
  woodGrain: 'hsla(24, 40%, 14%, 0.35)',
  brass: ['hsl(44, 62%, 62%)', 'hsl(38, 56%, 40%)'] as Stops,
  frostSpeck: 'hsla(200, 90%, 97%, 0.8)',
  /** Light the fridge lamp gives off when the compartment holds something dead: dim and cold. */
  lampHaunted: ['hsla(200, 30%, 70%, 0.14)', 'hsla(200, 30%, 70%, 0)'] as Stops,

  // Decay overlays on food tiles. Mould uses the aging (olive) and rotting (violet) stage hues,
  // so decay stays inside the freshness colour system.
  mould: ['hsla(72, 45%, 52%, 0.85)', 'hsla(275, 40%, 62%, 0.75)', 'hsla(90, 22%, 40%, 0.85)'] as const,
  yellowing: 'hsla(48, 70%, 50%, 0.14)',
  cobweb: 'hsla(220, 20%, 92%, 0.55)',
  ghost: 'hsla(220, 30%, 96%, 0.92)',
  ghostEye: 'hsl(228, 22%, 7%)',

  // Graveyard scene.
  night: ['hsl(232, 30%, 13%)', 'hsl(230, 24%, 9%)', 'hsl(228, 22%, 7%)'] as Stops,
  moon: 'hsl(48, 40%, 88%)',
  moonGlow: 'hsla(48, 60%, 88%, 0.10)',
  stone: ['hsl(220, 8%, 46%)', 'hsl(220, 9%, 32%)', 'hsl(222, 10%, 24%)'] as Stops,
  stoneEdge: 'hsl(222, 12%, 18%)',
  stoneText: 'hsl(220, 14%, 90%)',
  earth: ['hsl(24, 22%, 16%)', 'hsl(24, 20%, 9%)'] as Stops,
  /** Mist rising off the ground: clear at the top so it has no hard edge across the stones. */
  fog: ['hsla(220, 30%, 85%, 0)', 'hsla(220, 30%, 85%, 0.05)', 'hsla(220, 30%, 85%, 0.12)'] as Stops,

  // Storage doors (fridge screen, closed state).
  doorGap: 'hsl(220, 20%, 4%)',
  /** Light from expiring food: the expiring stage hue, so it stays inside the freshness colours. Dim over the
   *  near-black gap so it reads as a glow through a crack, not an orange stripe painted on. */
  ember: 'hsla(28, 92%, 52%, 0.6)',
  emberSpill: ['hsla(28, 95%, 60%, 0)', 'hsla(28, 95%, 60%, 0.32)'] as Stops,
  engraveOnSteel: 'hsl(220, 16%, 13%)',
  engraveOnWood: 'hsl(36, 40%, 86%)',
  steelBrush: 'hsla(0, 0%, 100%, 0.08)',
  panelLine: 'hsla(0, 0%, 0%, 0.22)',
  woodPanel: 'hsla(30, 40%, 60%, 0.10)',
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

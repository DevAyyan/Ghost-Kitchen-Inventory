const { hairlineWidth } = require('nativewind/theme');

const hsl = (name) => `hsl(var(--${name}))`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // "Larger text" (lib/text-scale.ts) makes size classes at run time, so they must exist even if no file
  // spells them out.
  safelist: [
    { pattern: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl)$/, variants: ['sm', 'md'] },
    'text-[12px]', 'text-[13px]', 'text-[14px]', 'text-[15px]', 'text-[16px]',
  ],
  theme: {
    borderRadius: { none: '0px', sm: '0px', DEFAULT: '0px', md: '0px', lg: '0px', xl: '0px', '2xl': '0px', '3xl': '0px', full: '0px' },
    // VT323 is drawn small for its size, so every step is bumped up to read like the usual scale. The two
    // smallest steps carry captions, chips and nav labels, so they get an extra pixel.
    fontSize: {
      xs: ['16px', '17px'], sm: ['18px', '20px'], base: ['19px', '22px'], lg: ['21px', '24px'], xl: ['23px', '26px'],
      '2xl': ['28px', '32px'], '3xl': ['32px', '36px'], '4xl': ['40px', '44px'],
    },
    extend: {
      colors: {
        border: hsl('border'),
        input: hsl('input'),
        ring: hsl('ring'),
        background: hsl('background'),
        foreground: hsl('foreground'),
        primary: { DEFAULT: hsl('primary'), foreground: hsl('primary-foreground') },
        secondary: { DEFAULT: hsl('secondary'), foreground: hsl('secondary-foreground') },
        destructive: { DEFAULT: hsl('destructive'), foreground: hsl('foreground') },
        muted: { DEFAULT: hsl('muted'), foreground: hsl('muted-foreground') },
        accent: { DEFAULT: hsl('accent'), foreground: hsl('accent-foreground') },
        popover: { DEFAULT: hsl('popover'), foreground: hsl('popover-foreground') },
        card: { DEFAULT: hsl('card'), foreground: hsl('card-foreground') },
        warning: hsl('warning'),
        stage: {
          fresh: hsl('stage-fresh'),
          aging: hsl('stage-aging'),
          expiring: hsl('stage-expiring'),
          rotting: hsl('stage-rotting'),
          spoiled: hsl('stage-spoiled'),
        },
        cabinet: { DEFAULT: hsl('cabinet'), shelf: hsl('cabinet-shelf') },
        pantry: hsl('pantry'),
        paper: { DEFAULT: hsl('paper'), foreground: hsl('paper-foreground') },
      },
      fontFamily: {
        // Pixel fonts (OFL, assets/fonts), loaded in app/_layout.tsx; until they load the system font is used.
        // Pixelify Sans only for page titles, the wordmark and the graveyard (words, not numbers: its 2 and 5
        // read as 8 and S). VT323 for everything else, card titles included, because its digits can't be
        // confused, which matters for dates and days left.
        display: ['PixelifySans'],
        heading: ['VT323'],
        pixel: ['VT323'],
      },
      // Pixel art has no curves: every radius is square (theme-level override below).
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require('tailwindcss-animate')],
};

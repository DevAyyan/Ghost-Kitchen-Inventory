/**
 * "Larger text": every font-size class one step up the scale. Arbitrary sizes (text-[13px]) grow by 2 px.
 * Works on the class string, so it applies to every Text without touching each screen. Pure, so it's tested.
 */
const STEPS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'] as const;
const NEXT: Record<string, string> = Object.fromEntries(STEPS.map((s, i) => [s, STEPS[Math.min(i + 1, STEPS.length - 1)]]));

export function largerText(className: string): string {
  return className
    .replace(/(^|\s)((?:[a-z]+:)*)text-(xs|sm|base|lg|xl|2xl|3xl|4xl)(?=\s|$)/g, (_, pre, variants, size) => `${pre}${variants}text-${NEXT[size]}`)
    .replace(/(^|\s)((?:[a-z]+:)*)text-\[(\d+)px\](?=\s|$)/g, (_, pre, variants, px) => `${pre}${variants}text-[${Number(px) + 2}px]`)
    // Fixed line heights would clip the bigger glyphs; let them follow the font size instead.
    .replace(/(^|\s)((?:[a-z]+:)*)leading-(3|3\.5|4|5|6|7)(?=\s|$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pixel-art gradients: smooth colour stops turned into a few hard bands. Pure, so it can be unit tested. */

/** Bands per gradient: few enough to read as pixel-art colour steps, enough to keep the shading. */
const BANDS = 6;

type Hsla = [number, number, number, number];

function parse(c: string): Hsla | null {
  const m = c.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
}

const fmt = ([h, s, l, a]: Hsla) => `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a.toFixed(3)})`;

/**
 * Turns smooth stops into hard colour bands (each band the colour at its middle), the way pixel art shades.
 * Colours it can't read are passed through, so the gradient still draws, just smoothly.
 */
export function banded(stops: readonly string[]): { colors: string[]; locations: number[] } | null {
  const parsed = stops.map(parse);
  if (parsed.some((p) => !p)) return null;
  const ps = parsed as Hsla[];
  const at = (t: number): Hsla => {
    const x = t * (ps.length - 1);
    const i = Math.min(ps.length - 2, Math.floor(x));
    const f = x - i;
    return ps[i].map((v, k) => v + (ps[i + 1][k] - v) * f) as Hsla;
  };
  const colors: string[] = [];
  const locations: number[] = [];
  for (let b = 0; b < BANDS; b++) {
    const c = fmt(at((b + 0.5) / BANDS));
    colors.push(c, c);
    locations.push(b / BANDS, (b + 1) / BANDS);
  }
  return { colors, locations };
}

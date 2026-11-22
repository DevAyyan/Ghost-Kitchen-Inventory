/**
 * Fits a short label (a food name) into a narrow box without breaking a word in the middle at random:
 * the largest size at which every word fits on a line, and, only when even the smallest size can't fit a
 * long word, a hyphen at a sensible place ("Strawber-ries"). Pure, so it's tested.
 *
 * Widths are measured averages for the pixel fonts (scripts measured them with the font files):
 * VT323 is monospaced at 0.40 em; Pixelify Sans letters run 0.57–0.77 em, so 0.64 covers a typical word.
 */
export const FONT_EM = { pixel: 0.4, display: 0.64 } as const;

export interface Fitted {
  size: number;
  /** The text to show: the name, or with a hyphen and line break inside an over-long word. */
  text: string;
  /** How many lines it needs (at most `maxLines`). */
  lines: number;
}

const VOWEL = /[aeiouy]/i;
/** Letter pairs that make one sound, so a hyphen never goes between them. */
const DIGRAPHS = new Set(['sh', 'ch', 'th', 'ph', 'ck', 'wh', 'gh', 'qu', 'ng']);

/**
 * Where to break `word` so the first part (plus a hyphen) fits `max` characters, keeping at least 3 letters
 * on each side: between two consonants first ("Mush-rooms", "Straw-berries"), then after a vowel before a
 * consonant ("Cucum-ber"), then wherever it has to.
 */
function breakAt(word: string, max: number): number {
  const limit = Math.min(max - 1, word.length - 3);
  const isV = (i: number) => VOWEL.test(word[i]!);
  const range = Array.from({ length: Math.max(0, limit - 2) }, (_, k) => limit - k);
  const pair = (i: number) => word.slice(i - 1, i + 1).toLowerCase();
  const cc = range.find((i) => !isV(i - 1) && !isV(i) && !DIGRAPHS.has(pair(i)));
  if (cc) return cc;
  const vc = range.find((i) => isV(i - 1) && !isV(i));
  return vc ?? Math.max(3, limit);
}

/**
 * The largest of `sizes` at which `text` fits on one line in `roomPx`, or the smallest if none does
 * (the text is then cut with an ellipsis rather than wrapping). For short lines that must not wrap.
 */
export function fitOneLine(text: string, roomPx: number, em: number, sizes: number[]): number {
  const desc = [...sizes].sort((a, b) => b - a);
  return desc.find((s) => text.length * s * em <= roomPx) ?? desc[desc.length - 1]!;
}

export function fitLabel(text: string, roomPx: number, em: number, sizes: number[], maxLines = 2): Fitted {
  const words = text.trim().split(/\s+/);
  const longest = Math.max(...words.map((w) => w.length));
  const desc = [...sizes].sort((a, b) => b - a);
  for (const size of desc) {
    const perLine = Math.floor(roomPx / (size * em));
    if (longest <= perLine) return { size, text, lines: Math.min(maxLines, linesFor(words, perLine)) };
  }
  // Even the smallest size is too big for a word: hyphenate the long ones.
  const size = desc[desc.length - 1]!;
  const perLine = Math.max(4, Math.floor(roomPx / (size * em)));
  const out = words.map((w) => (w.length > perLine ? `${w.slice(0, breakAt(w, perLine))}-\n${w.slice(breakAt(w, perLine))}` : w));
  return { size, text: out.join(' '), lines: maxLines };
}

/** Lines needed to set `words` greedily at `perLine` characters. */
function linesFor(words: string[], perLine: number): number {
  let lines = 1;
  let used = 0;
  for (const w of words) {
    if (used === 0) used = w.length;
    else if (used + 1 + w.length <= perLine) used += 1 + w.length;
    else { lines++; used = w.length; }
  }
  return lines;
}

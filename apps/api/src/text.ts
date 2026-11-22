/**
 * Repairs mojibake: UTF-8 text that was decoded as Windows-1252 somewhere upstream, so "Sauté" arrives as
 * "SautÃ©" and "it’s" as "itâ€™s". Both Gemini and TheMealDB data occasionally carry it. Only text that
 * re-encodes cleanly to valid UTF-8 is changed, so ordinary accented text is left alone.
 */

// Windows-1252 bytes 0x80–0x9F that aren't the same code point in Unicode.
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a,
  '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/** A lead byte of a 2–4 byte UTF-8 sequence (as Latin-1), followed by a continuation byte (as CP1252). */
const SUSPECT = /[\u00c2-\u00f4][\u0080-\u00bf€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/;
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Re-decodes one run of suspect characters; returns null if it isn't mojibake after all. */
function redecode(run: string): string | null {
  const bytes: number[] = [];
  for (const ch of run) {
    const code = ch.codePointAt(0)!;
    if (code < 0x100) bytes.push(code);
    else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch]);
    else return null;
  }
  try {
    return decoder.decode(new Uint8Array(bytes));
  } catch {
    return null;
  }
}

export function fixMojibake(s: string): string {
  // Fix each run of Latin-1/CP1252 characters on its own, so one odd character can't block the rest.
  const fixed = SUSPECT.test(s)
    ? s.replace(/[\u0080-\u00ff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]+/g, (run) => (SUSPECT.test(run) ? redecode(run) ?? run : run))
    : s;
  // Then drop stray C1 control characters, which never belong in display text.
  return fixed.replace(/[\u0080-\u009f]/g, '');
}

/** Applies fixMojibake to every string inside a parsed JSON value. */
export function fixMojibakeDeep<T>(value: T): T {
  if (typeof value === 'string') return fixMojibake(value) as T;
  if (Array.isArray(value)) return value.map(fixMojibakeDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixMojibakeDeep(v)])) as T;
  }
  return value;
}

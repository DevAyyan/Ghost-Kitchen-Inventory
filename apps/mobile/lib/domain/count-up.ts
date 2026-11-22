/** Length of a money count-up. */
export const COUNT_UP_MS = 700;

/** 0..1 progress of a count-up after `elapsed` ms, in whole steps like the rest of the pixel art. */
export const countUpAt = (elapsed: number, steps = 8) =>
  Math.min(1, Math.ceil((Math.min(Math.max(0, elapsed), COUNT_UP_MS) / COUNT_UP_MS) * steps) / steps);

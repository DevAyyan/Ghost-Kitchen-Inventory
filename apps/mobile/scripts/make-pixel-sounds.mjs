// Generates the 8-bit sound effects in assets/sounds/chip-*.wav from scratch (no recordings, so no licences).
// Run from apps/mobile:  node scripts/make-pixel-sounds.mjs
// Chiptune style to match the pixel-art UI (square and triangle waves, a noise channel, 4-bit volume), and
// spooky to match the haunted kitchen. Deterministic, so every run writes identical files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
/** Each note lasts a whole number of these, like rows in a tracker. */
const ROW = 0.035;

let seed = 4242;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const hz = (semis) => 440 * 2 ** (semis / 12);
const quant = (v) => Math.round(v * 15) / 15; // 4-bit volume

const wave = {
  square: (p, duty = 0.5) => ((p % 1) < duty ? 1 : -1),
  triangle: (p) => 4 * Math.abs((p % 1) - 0.5) - 1,
};

/**
 * One channel: a list of [semitone from A4 or null for rest, rows, volume 0..1] steps.
 * `kind` picks the waveform; noise uses the semitone as a rough pitch for how often it re-rolls.
 * `vibrato` is a wobble in semitones (`rate` per second), stepped like a tracker's pitch table, which is
 * what makes a chiptune note sound ghostly rather than cheerful. `detune` shifts the whole channel.
 */
function channel(steps, kind = 'square', duty = 0.5, { vibrato = 0, rate = 6, detune = 0 } = {}) {
  const out = [];
  let phase = 0;
  let held = 0;
  let noiseVal = 0;
  let t = 0;
  for (const [semi, rows, vol] of steps) {
    const n = Math.round(rows * ROW * RATE);
    for (let i = 0; i < n; i++, t++) {
      if (semi === null) { out.push(0); continue; }
      // Stepped wobble: 8 pitch steps per cycle, not a smooth sine.
      const wob = vibrato ? Math.round(Math.sin((2 * Math.PI * rate * t) / RATE) * 4) / 4 * vibrato : 0;
      const f = hz(semi + detune + wob);
      phase += f / RATE;
      // Volume steps down over the note, in 4-bit steps.
      const v = quant(vol * (1 - (i / n) * 0.6));
      if (kind === 'noise') {
        held += f / RATE;
        if (held >= 1) { held -= 1; noiseVal = rand() * 2 - 1; }
        out.push(noiseVal * v);
      } else {
        out.push((kind === 'triangle' ? wave.triangle(phase) : wave.square(phase, duty)) * v);
      }
    }
  }
  return out;
}

/** A chiptune echo: the sound repeated `times`, each `delay` seconds later and quieter, like a haunted hall. */
function echo(x, delay = 0.12, decay = 0.45, times = 3) {
  const d = Math.round(delay * RATE);
  const out = new Float32Array(x.length + d * times);
  for (let k = 0; k <= times; k++) {
    const g = decay ** k;
    for (let i = 0; i < x.length; i++) out[i + d * k] += x[i] * g;
  }
  return out;
}

function mix(...chs) {
  const len = Math.max(...chs.map((c) => c.length));
  const out = new Float32Array(len);
  for (const c of chs) for (let i = 0; i < c.length; i++) out[i] += c[i] / chs.length;
  return out;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  // A short fade at each end so nothing clicks.
  const fade = Math.round(0.004 * RATE);
  samples.forEach((s, i) => {
    const edge = Math.min(1, i / fade, (samples.length - 1 - i) / fade);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * edge)) * 0.8 * 32767), i * 2);
  });
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

// Spooky on purpose: diminished arpeggios (0, 3, 6, 9 semitones) and tritones (6) instead of major and minor
// chords, slow falling chromatic lines, a stepped vibrato, two voices a little out of tune with each other,
// a breath of noise like wind, and an echo tail.
const SOUNDS = {
  // Fridge opening: a cold breath of air, then a rising diminished arpeggio that wobbles, two voices beating.
  'chip-fridge-open': echo(mix(
    channel([[10, 3, 0.5], [6, 4, 0.35]], 'noise'),
    channel([[null, 1, 0], [-12, 2, 0.7], [-9, 2, 0.7], [-6, 2, 0.7], [-3, 5, 0.6]], 'square', 0.25, { vibrato: 0.4, rate: 7 }),
    channel([[null, 1, 0], [-12, 2, 0.5], [-9, 2, 0.5], [-6, 2, 0.5], [-3, 5, 0.4]], 'triangle', 0.5, { detune: 0.25 }),
  )),
  // Fridge closing: the arpeggio falls back by a tritone, and the door shuts with a dull thud.
  'chip-fridge-close': echo(mix(
    channel([[-3, 2, 0.6], [-6, 2, 0.6], [-9, 2, 0.6], [-15, 4, 0.5]], 'square', 0.25, { vibrato: 0.4, rate: 7 }),
    channel([[null, 9, 0], [-10, 2, 0.9], [-20, 2, 0.5]], 'noise'),
  ), 0.1, 0.35, 2),
  // Freezer opening: an icy hiss and a high, glassy, wavering tritone, like a music box gone wrong.
  'chip-freezer-open': echo(mix(
    channel([[40, 8, 0.4]], 'noise'),
    channel([[12, 3, 0.6], [18, 3, 0.6], [15, 2, 0.5], [21, 5, 0.5]], 'triangle', 0.5, { vibrato: 0.5, rate: 9 }),
    channel([[12, 3, 0.4], [18, 3, 0.4], [15, 2, 0.3], [21, 5, 0.3]], 'square', 0.125, { detune: -0.3 }),
  ), 0.14, 0.5, 3),
  'chip-freezer-close': echo(mix(
    channel([[21, 2, 0.5], [18, 2, 0.5], [15, 2, 0.5], [12, 4, 0.4]], 'triangle', 0.5, { vibrato: 0.5, rate: 9 }),
    channel([[null, 8, 0], [25, 2, 0.7]], 'noise'),
  ), 0.14, 0.45, 2),
  // Pantry opening: a long creak that slides up a semitone at a time, and a low moan underneath.
  'chip-pantry-open': echo(mix(
    channel([[-26, 2, 0.6], [-25, 2, 0.6], [-24, 2, 0.6], [-25, 1, 0.6], [-23, 2, 0.6], [-22, 3, 0.5]], 'square', 0.125),
    channel([[-30, 12, 0.5]], 'triangle', 0.5, { vibrato: 0.6, rate: 4 }),
  ), 0.16, 0.4, 2),
  // Pantry closing: the creak slides back down, then a hollow wooden knock that echoes.
  'chip-pantry-close': echo(mix(
    channel([[-22, 2, 0.6], [-24, 2, 0.6], [-27, 3, 0.5]], 'square', 0.125),
    channel([[null, 7, 0], [2, 2, 0.9], [null, 1, 0], [-2, 2, 0.6]], 'noise'),
  ), 0.18, 0.45, 3),
  // Burying spoiled food: a shovel of earth, then a funeral bell tolling down a diminished chord.
  bury: echo(mix(
    channel([[0, 3, 0.9], [null, 2, 0], [-3, 3, 0.8]], 'noise'),
    channel([[null, 3, 0], [-12, 5, 0.7], [-15, 5, 0.6], [-18, 5, 0.6], [-24, 10, 0.5]], 'triangle', 0.5, { vibrato: 0.3, rate: 5 }),
    channel([[null, 3, 0], [-12, 5, 0.4], [-15, 5, 0.35], [-18, 5, 0.35], [-24, 10, 0.3]], 'square', 0.5, { detune: 0.2 }),
  ), 0.2, 0.45, 3),
  // A ghost's "oooOOOooo": a slow wavering wail that rises a tritone and sinks away.
  ghost: echo(mix(
    channel([[0, 4, 0.4], [3, 3, 0.55], [6, 6, 0.65], [3, 3, 0.5], [-1, 6, 0.35]], 'triangle', 0.5, { vibrato: 0.7, rate: 5 }),
    channel([[0, 4, 0.25], [3, 3, 0.35], [6, 6, 0.4], [3, 3, 0.3], [-1, 6, 0.2]], 'square', 0.5, { vibrato: 0.7, rate: 5, detune: 0.3 }),
  ), 0.15, 0.4, 2),
  // Rescuing food: the ghost is set free. A rising arpeggio that resolves upward, with a twinkle on top.
  // Added last so the seeded noise of the sounds above stays identical.
  rescue: echo(mix(
    channel([[0, 2, 0.5], [4, 2, 0.55], [7, 2, 0.6], [12, 5, 0.6], [null, 1, 0], [16, 4, 0.4]], 'square', 0.25),
    channel([[-12, 6, 0.35], [-5, 6, 0.3], [0, 6, 0.25]], 'triangle'),
  ), 0.1, 0.35, 2),
  // Something spoiled: a low groan that sinks, under a rattle of noise.
  spoil: echo(mix(
    channel([[-17, 5, 0.5], [-18, 5, 0.45], [-20, 8, 0.4]], 'triangle', 0.5, { vibrato: 0.5, rate: 4 }),
    channel([[6, 4, 0.15], [null, 2, 0], [6, 3, 0.1]], 'noise'),
  ), 0.18, 0.35, 2),
};

mkdirSync(OUT, { recursive: true });
for (const [name, s] of Object.entries(SOUNDS)) {
  const file = name.startsWith('chip-') ? `${name}.wav` : `chip-${name}.wav`;
  writeFileSync(join(OUT, file), wav(s));
  console.log(file, `${(s.length / RATE).toFixed(2)} s`);
}

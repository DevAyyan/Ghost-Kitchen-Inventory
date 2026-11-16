// Generates the door sound effects in assets/sounds/ from scratch (no recordings, so no licences to track).
// Run from apps/mobile:  node scripts/make-door-sounds.mjs
// Each sound is a few short layers: filtered noise for air and rubber, decaying tones for thuds and
// knocks, and a resonant swept tone for the pantry's creak. Seeded, so every run writes identical files.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

let seed = 12345;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rand() * 2 - 1;

const buffer = (seconds) => new Float32Array(Math.round(seconds * RATE));
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

/** One-pole low-pass / high-pass over a whole buffer. */
function lowpass(x, hz) { const a = 1 - Math.exp((-2 * Math.PI * hz) / RATE); let y = 0; return x.map((v) => (y += a * (v - y))); }
function highpass(x, hz) { const lp = lowpass(x, hz); return x.map((v, i) => v - lp[i]); }
/** Two-pole resonator: a band-pass that rings at `hz`, like a wooden panel or a cavity. */
function resonate(x, hz, q) {
  const w = (2 * Math.PI * hz) / RATE, r = Math.exp(-w / (2 * q));
  const a1 = 2 * r * Math.cos(w), a2 = -r * r;
  let y1 = 0, y2 = 0;
  return x.map((v) => { const y = v * (1 - r) + a1 * y1 + a2 * y2; y2 = y1; y1 = y; return y; });
}
function mixInto(out, layer, gain, offset = 0) {
  const start = Math.round(offset * RATE);
  for (let i = 0; i < layer.length && start + i < out.length; i++) out[start + i] += layer[i] * gain;
}

/** Rubber gasket letting go: a low "thwop" of air plus a little suction. */
function sealPop(len = 0.18) {
  const n = buffer(len).map((_, i) => noise() * env(i / RATE, 0.004, 0.035));
  return resonate(lowpass(n, 900), 160, 3);
}
/** Door hitting the cabinet: a low sine thump with a short body of filtered noise. */
function thud(hz, len = 0.35, decay = 0.07) {
  const tone = buffer(len).map((_, i) => { const t = i / RATE; return Math.sin(2 * Math.PI * (hz + 40 * Math.exp(-t / 0.02)) * t) * env(t, 0.002, decay); });
  const body = lowpass(buffer(len).map((_, i) => noise() * env(i / RATE, 0.001, 0.02)), 500);
  return tone.map((v, i) => v + body[i] * 0.6);
}
/** Cold air rolling out of a freezer: soft high hiss that swells and fades. */
function hiss(len, from = 2500) {
  const n = buffer(len).map((_, i) => { const t = i / RATE; return noise() * Math.sin(Math.PI * Math.min(1, t / len)) ** 2; });
  return lowpass(highpass(n, from), 7000);
}
/** Fridge compressor waking up: a quiet low hum that fades in. */
function hum(len) {
  return buffer(len).map((_, i) => { const t = i / RATE; return (Math.sin(2 * Math.PI * 100 * t) * 0.6 + Math.sin(2 * Math.PI * 200 * t) * 0.3) * Math.min(1, t / 0.25) * Math.exp(-t / 0.5); });
}
/** Old hinge: stick-slip pulses through a wooden resonance, pitch wandering as the door swings. */
function creak(len, f0, f1) {
  const out = buffer(len);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const f = f0 + (f1 - f0) * (t / len) + 25 * Math.sin(2 * Math.PI * 3.1 * t);
    phase += f / RATE;
    const pulse = phase % 1 < 0.08 ? 1 : 0; // friction "catches" once per cycle
    out[i] = pulse * Math.sin(Math.PI * Math.min(1, t / len)) * (0.7 + 0.3 * noise());
  }
  return resonate(resonate(out, 900, 6), 1700, 4);
}
/** Wood on wood: two short knocks ringing at the panel's resonances. */
function knock(len = 0.25) {
  const click = buffer(len).map((_, i) => noise() * env(i / RATE, 0.0005, 0.004));
  const a = resonate(click, 230, 12), b = resonate(click, 520, 10);
  return a.map((v, i) => v + b[i] * 0.6);
}

function normalize(x, peak = 0.8) {
  const max = x.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  // Short fades at both ends so nothing clicks.
  const fade = Math.round(0.004 * RATE);
  return x.map((v, i) => (v / max) * peak * Math.min(1, i / fade, (x.length - 1 - i) / fade));
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const sounds = {
  'fridge-open': () => { const o = buffer(0.6); mixInto(o, sealPop(), 1); mixInto(o, hum(0.55), 0.25, 0.05); return o; },
  'fridge-close': () => { const o = buffer(0.45); mixInto(o, thud(70), 1); mixInto(o, sealPop(0.12), 0.45, 0.03); return o; },
  'freezer-open': () => { const o = buffer(0.75); mixInto(o, sealPop(), 1); mixInto(o, hiss(0.65), 0.45, 0.03); return o; },
  'freezer-close': () => { const o = buffer(0.5); mixInto(o, thud(60, 0.4, 0.09), 1); mixInto(o, hiss(0.2, 3500), 0.2, 0.02); return o; },
  'pantry-open': () => { const o = buffer(0.75); mixInto(o, creak(0.65, 160, 230), 1, 0.02); mixInto(o, knock(0.15), 0.25); return o; },
  'pantry-close': () => { const o = buffer(0.4); mixInto(o, creak(0.18, 260, 200), 0.5); mixInto(o, knock(), 1, 0.14); return o; },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  const file = wav(normalize(make()));
  writeFileSync(join(OUT, `${name}.wav`), file);
  console.log(`${name}.wav  ${(file.length / 1024).toFixed(1)} KB`);
}

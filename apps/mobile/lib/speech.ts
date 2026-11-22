import type { ExpoSpeechRecognitionModule as Module } from 'expo-speech-recognition';
import { Platform } from 'react-native';

/**
 * Speech to text through expo-speech-recognition: Android's recognizer on phones, the Web Speech API in
 * browsers that have it. Loaded defensively: the native module is missing in Expo Go and old builds, and
 * some browsers have no recognizer. Then voice is unavailable and typing the same sentence still works.
 */
let mod: typeof Module | null | undefined;
function speech(): typeof Module | null {
  if (mod !== undefined) return mod;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = (require('expo-speech-recognition') as { ExpoSpeechRecognitionModule: typeof Module }).ExpoSpeechRecognitionModule;
    if (!mod?.isRecognitionAvailable()) mod = null;
  } catch {
    mod = null;
  }
  return mod;
}

export const speechAvailable = () => speech() !== null;

/** Why voice can't be offered here, in words, or null when it can. */
export function speechUnavailableReason(): string | null {
  if (speechAvailable()) return null;
  if (Platform.OS === 'web') return 'Voice works in Chrome, Edge, Safari and the Android app. Typing works everywhere.';
  return 'Voice needs the installed Ghost Kitchen app; it isn\'t available in Expo Go. Typing works.';
}

/**
 * Some browsers expose the speech API but never answer: Chromium and Brave lack Google's speech service,
 * and their recognizer can sit silent. Without these limits the app would say "Listening…" forever.
 */
const START_TIMEOUT_MS = 4_000;
const HEAR_TIMEOUT_MS = 10_000;

const ERRORS: Record<string, string> = {
  'not-allowed': 'The microphone is blocked. Allow it for this site in your browser, or type it instead.',
  'service-not-allowed': "This browser doesn't allow speech recognition. Try Chrome, Edge or Safari, or type it instead.",
  network: "Can't reach your browser's speech service. Voice needs an internet connection, and works in Chrome, Edge and Safari but not Chromium or Brave. Type it instead.",
  'audio-capture': 'No microphone found. Plug one in, or type it instead.',
  'language-not-supported': "Your speech service doesn't support English here. Type it instead.",
  'no-speech': "Didn't catch that. Try again, a bit closer.",
  'speech-timeout': "Didn't catch that. Try again, a bit closer.",
  busy: 'The speech service is busy. Try again in a moment.',
};

export type ListenEvents = {
  /** The words so far; `final` once the speaker stops. */
  onText: (text: string, final: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

/**
 * Asks for the microphone, then listens for one sentence. Always ends with exactly one onEnd, after an
 * onError if something went wrong. Returns a function that stops listening.
 */
export async function listen(ev: ListenEvents): Promise<() => void> {
  const m = speech();
  if (!m) { ev.onError(speechUnavailableReason() ?? "Voice isn't available here."); ev.onEnd(); return () => {}; }
  // Browsers only give the microphone to https pages and localhost; on a LAN address over http it's refused.
  if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
    ev.onError('Voice needs this page on https (or localhost). Type it instead, or open the app on localhost.');
    ev.onEnd();
    return () => {};
  }
  const perm = await m.requestPermissionsAsync().catch(() => null);
  if (!perm?.granted) { ev.onError('Microphone access is off. Allow it in your settings, or type it instead.'); ev.onEnd(); return () => {}; }

  let done = false, started = false, heard = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const finish = (message?: string) => {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    subs.forEach((s) => s.remove());
    try { m.abort(); } catch { /* already stopped */ }
    if (message) ev.onError(message);
    ev.onEnd();
  };
  const subs = [
    m.addListener('start', () => { started = true; }),
    m.addListener('audiostart', () => { started = true; }),
    m.addListener('result', (e) => {
      started = true;
      const t = e.results[0]?.transcript ?? '';
      if (!t) return;
      heard = true;
      ev.onText(t, e.isFinal);
      if (e.isFinal) finish();
    }),
    m.addListener('end', () => finish(heard ? undefined : ERRORS['no-speech'])),
    m.addListener('error', (e) => {
      if (e.error === 'aborted') return finish();
      finish(ERRORS[e.error] ?? "Couldn't listen just now. Type it instead.");
    }),
  ];
  timers.push(setTimeout(() => { if (!started) finish("Your browser's speech service isn't answering. Voice works in Chrome, Edge, Safari and the Android app. Type it instead."); }, START_TIMEOUT_MS));
  timers.push(setTimeout(() => { if (!heard) finish(ERRORS['no-speech']); }, HEAR_TIMEOUT_MS));
  try {
    m.start({ lang: 'en-US', interimResults: true, continuous: false, maxAlternatives: 1 });
  } catch {
    finish("Couldn't start listening. Type it instead.");
  }
  return () => { if (!done) { try { m.stop(); } catch { finish(); } } };
}

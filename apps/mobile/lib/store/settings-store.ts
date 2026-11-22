import { isKnownCurrency } from '@/lib/currency/catalog';
import { DIETS, type Diet } from '@/lib/domain/diets';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { migrateSettings, SETTINGS_VERSION } from './settings-migrations';
import { safeStorage } from './storage';

/** Currency for a new install, until the user picks another. */
export const DEFAULT_CURRENCY = 'USD';

export interface Settings {
  defaultCurrency: string;
  displayCurrency: string;
  /** Recipe filters; all selected diets must be satisfied. */
  diets: Diet[];
  reduceMotion: boolean;
  /** AI off: receipts are read with basic rules and dates use rough category estimates. */
  tesseractOnly: boolean;
  aiNoticeSeen: boolean;
  /** Item photos go to Gemini as images (receipts only send text), so they get their own notice. */
  itemPhotoNoticeSeen: boolean;
  /** Ghost Kitchen server, e.g. https://kitchen.example.com. Empty = build default / same origin on web. */
  apiUrl: string;
  /** Matches the server's API_TOKEN, if it has one. */
  apiToken: string;
  /** Daily "cook this tonight" reminder (Android and iOS). Off until the user asks. */
  notifyDigest: boolean;
  /** Hour of day (0-23) the reminder arrives. */
  notifyHour: number;
  /** Monday "your week in food" notification (Android and iOS). The web shows the same as a card. */
  notifyWeekly: boolean;
  /** Start (Monday) of the last weekly summary the user dismissed on the fridge screen. */
  weeklySeen: string;
  /** Text a step larger everywhere, for the small pixel font. */
  largeText: boolean;
  /** Door sounds and the small vibration that goes with them. */
  soundEffects: boolean;
  /** The fridge screen as the drawn kitchen, or as a "use first" list with swipe actions. */
  fridgeView: 'kitchen' | 'list';
  /** Doors opened by hand, up to DOOR_HINT_OPENS: the "Tap to open" hint goes once it's been learned. */
  doorOpens: number;
  /** The three-step first-run intro has been finished or skipped. */
  introSeen: boolean;
  /** Optional grocery budget for the calendar month, in minor units of `monthlyBudgetCurrency`. 0 = no budget. */
  monthlyBudgetMinor: number;
  monthlyBudgetCurrency: string;
  /** Server calls are answered from recorded sample data on the device (lib/demo). For demos with no network. */
  demoMode: boolean;
}

/** After this many opens the doors stop saying "Tap to open". */
export const DOOR_HINT_OPENS = 3;

interface SettingsState {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export const SETTINGS_KEY = 'ghost-kitchen-settings';
/** Before v6 settings lived inside the main data blob under this key. */
const LEGACY_KEY = 'ghost-kitchen';

export function defaultSettings(): Settings {
  // US dollars until the user picks another. (The device's region used to decide, which gave rupees,
  // pounds or euros to people who think in dollars, and mislabelled the dollar-priced sample data.)
  const cur = DEFAULT_CURRENCY;
  return {
    defaultCurrency: cur,
    displayCurrency: cur,
    diets: [],
    reduceMotion: false,
    tesseractOnly: false,
    aiNoticeSeen: false,
    itemPhotoNoticeSeen: false,
    apiUrl: '',
    apiToken: '',
    notifyDigest: false,
    notifyHour: 17,
    notifyWeekly: false,
    weeklySeen: '',
    largeText: false,
    soundEffects: true,
    doorOpens: 0,
    fridgeView: 'kitchen',
    introSeen: false,
    monthlyBudgetMinor: 0,
    monthlyBudgetCurrency: cur,
    demoMode: false,
  };
}

const isDiet = (v: unknown): v is Diet =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(DIETS, v);

/**
 * Turns whatever was stored into valid settings: unknown currencies, diets and wrong types fall back to
 * defaults, and settings added in later versions get their default. Used on load and on every update.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const d = defaultSettings();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const currency = (v: unknown) => (typeof v === 'string' && isKnownCurrency(v) ? v : null);
  const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 500) : '');
  const defaultCurrency = currency(r.defaultCurrency) ?? d.defaultCurrency;
  const displayCurrency = currency(r.displayCurrency) ?? defaultCurrency;
  return {
    defaultCurrency,
    displayCurrency,
    diets: Array.isArray(r.diets) ? [...new Set(r.diets.filter(isDiet))] : d.diets,
    reduceMotion: bool(r.reduceMotion, d.reduceMotion),
    tesseractOnly: bool(r.tesseractOnly, d.tesseractOnly),
    aiNoticeSeen: bool(r.aiNoticeSeen, d.aiNoticeSeen),
    itemPhotoNoticeSeen: bool(r.itemPhotoNoticeSeen, d.itemPhotoNoticeSeen),
    apiUrl: text(r.apiUrl).replace(/\/+$/, ''),
    apiToken: text(r.apiToken),
    notifyDigest: bool(r.notifyDigest, d.notifyDigest),
    notifyWeekly: bool(r.notifyWeekly, d.notifyWeekly),
    weeklySeen:
      typeof r.weeklySeen === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.weeklySeen)
        ? r.weeklySeen
        : '',
    notifyHour:
      typeof r.notifyHour === 'number' &&
      Number.isInteger(r.notifyHour) &&
      r.notifyHour >= 0 &&
      r.notifyHour <= 23
        ? r.notifyHour
        : d.notifyHour,
    largeText: bool(r.largeText, d.largeText),
    soundEffects: bool(r.soundEffects, d.soundEffects),
    doorOpens:
      typeof r.doorOpens === 'number' && Number.isInteger(r.doorOpens) && r.doorOpens >= 0
        ? Math.min(r.doorOpens, DOOR_HINT_OPENS)
        : d.doorOpens,
    fridgeView: r.fridgeView === 'list' ? 'list' : 'kitchen',
    introSeen: bool(r.introSeen, d.introSeen),
    monthlyBudgetMinor:
      typeof r.monthlyBudgetMinor === 'number' && Number.isSafeInteger(r.monthlyBudgetMinor) && r.monthlyBudgetMinor > 0 && r.monthlyBudgetMinor <= 1e12
        ? r.monthlyBudgetMinor
        : 0,
    monthlyBudgetCurrency: currency(r.monthlyBudgetCurrency) ?? displayCurrency,
    demoMode: bool(r.demoMode, d.demoMode),
  };
}

/** First run after the split: lift the settings out of the old combined blob (keeping its version). */
function legacySettings(raw: string): string | null {
  try {
    const old = JSON.parse(raw) as { state?: { settings?: unknown }; version?: number };
    return old.state?.settings
      ? JSON.stringify({ state: { settings: old.state.settings }, version: old.version ?? 0 })
      : null;
  } catch {
    return null;
  }
}


/**
 * User preferences, saved on the device separately from fridge data: a small entry that keeps saving
 * even if the data entry can't (e.g. web storage full of photos), and that "Delete all data" leaves alone.
 */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings(),
      update: (patch) => set((s) => ({ settings: sanitizeSettings({ ...s.settings, ...patch }) })),
    }),
    {
      name: SETTINGS_KEY,
      // Continues the old blob's numbering, so carried-over settings run the migrations below.
      version: SETTINGS_VERSION,
      storage: createJSONStorage(() =>
        safeStorage('settings', { key: LEGACY_KEY, extract: legacySettings })
      ),
      partialize: (s) => ({ settings: s.settings }),
      migrate: (persisted, version) =>
        migrateSettings(persisted, version) as unknown as SettingsState,
      merge: (persisted, current) => ({
        ...current,
        settings: sanitizeSettings((persisted as Partial<SettingsState> | undefined)?.settings),
      }),
    }
  )
);

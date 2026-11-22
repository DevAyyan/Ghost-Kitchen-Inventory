/** The settings store's version, and the steps that bring older saved settings up to it. Pure, so it's tested. */
export const SETTINGS_VERSION = 12;

/** Brings saved settings from an older version up to this one, step by step. Kept out of the store so it can be tested. */
export function migrateSettings(persisted: unknown, version: number) {
  const s = (persisted ?? {}) as { settings?: Record<string, unknown> };
  // v2 had a single vegetarian flag instead of a diet list.
  if (version < 3 && s.settings) {
    const { vegetarian, ...rest } = s.settings;
    s.settings = {
      ...rest,
      diets: Array.isArray(rest.diets) ? rest.diets : vegetarian ? ['vegetarian'] : [],
    };
  }
  // v6 had no storage doors: start with every door open, like the fridge looked before.
  if (version < 7 && s.settings) s.settings = { ...s.settings, doorsClosed: [] };
  // v7 had no door sounds: on by default, like a real fridge.
  if (version < 8 && s.settings) s.settings = { ...s.settings, soundEffects: true };
  // v8 had only the drawn kitchen: keep showing it.
  if (version < 9 && s.settings) s.settings = { ...s.settings, fridgeView: 'kitchen' };
  // v9 had no intro. Anyone upgrading already knows the app, so they don't get a welcome tour.
  if (version < 10 && s.settings) s.settings = { ...s.settings, introSeen: true };
  // v10 remembered which storage doors were shut. The pixel kitchen opens one door at a time and
  // starts closed, so that's gone; larger text is new and starts off.
  if (version < 11 && s.settings) {
    const { doorsClosed: _gone, ...rest } = s.settings;
    s.settings = { ...rest, largeText: false };
  }
  // v11 had no monthly budget and no demo mode: both start off.
  if (version < 12 && s.settings) s.settings = { ...s.settings, monthlyBudgetMinor: 0, demoMode: false };
  return s;
}

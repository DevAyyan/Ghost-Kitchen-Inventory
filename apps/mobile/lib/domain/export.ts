import type { Item, ItemEvent, PlanEntry, Receipt, ShoppingItem } from './types';

export const EXPORT_FORMAT = 1;

export interface ExportInput {
  items: Item[];
  receipts: Receipt[];
  events: ItemEvent[];
  shopping: ShoppingItem[];
  plan: PlanEntry[];
  /** Settings as stored. Only the keys in SAFE_SETTINGS are written. */
  settings: Record<string, unknown>;
  exportedAt: string;
  appVersion: string;
}

/**
 * Settings worth keeping in a copy of your data. The server address and token are left out on purpose:
 * the token is a credential, and an export is a file people share and forget about.
 */
const SAFE_SETTINGS = ['defaultCurrency', 'displayCurrency', 'diets', 'monthlyBudgetMinor', 'monthlyBudgetCurrency', 'notifyDigest', 'notifyHour', 'notifyWeekly', 'largeText', 'reduceMotion', 'soundEffects', 'fridgeView'] as const;

/**
 * Everything the user has in the app, as JSON they can keep. Photos are not included: on a phone they are
 * files and on the web they are large inline images, so the export lists only whether an item had one.
 */
export function buildExport(input: ExportInput): string {
  const settings = Object.fromEntries(SAFE_SETTINGS.filter((k) => k in input.settings).map((k) => [k, input.settings[k]]));
  const out = {
    app: 'Ghost Kitchen',
    format: EXPORT_FORMAT,
    exportedAt: input.exportedAt,
    appVersion: input.appVersion,
    note: 'Photos are not included. Dates marked unconfirmed are estimates: check the package and the food itself.',
    settings,
    items: input.items.map(({ photoUri, ...it }) => ({ ...it, hadPhoto: Boolean(photoUri) })),
    receipts: input.receipts,
    history: input.events.map(({ photoUri, ...e }) => ({ ...e, hadPhoto: Boolean(photoUri) })),
    shopping: input.shopping,
    plan: input.plan.map(({ thumb: _t, ...p }) => p),
  };
  return JSON.stringify(out, null, 2);
}

export const exportFileName = (date: string) => `ghost-kitchen-${date}.json`;

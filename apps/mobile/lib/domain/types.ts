/** Domain types. Kept free of React Native imports so they can move to packages/shared. */
import type { Unit } from './units';

export type { Unit };

export type Stage = 'fresh' | 'aging' | 'expiring' | 'rotting' | 'spoiled';

export type Category =
  | 'produce' | 'dairy' | 'meat' | 'fish' | 'eggs' | 'leftovers'
  | 'bakery' | 'dry' | 'frozen' | 'condiment' | 'drink' | 'other';

/** Storage section. Only the three that change shelf life meaningfully (see catalog.ZONES). */
export type Zone = 'freezer' | 'fridge' | 'pantry';

/** Calendar date as YYYY-MM-DD, local time. Strings keep persistence and comparison simple. */
export type IsoDate = string;

/**
 * Where an expiry date came from.
 * model = Gemini's shelf-life answer; category = offline fallback; user = typed or adjusted by the user;
 * package = read from the date printed on the pack in a photo (still worth a glance);
 * learned = the usual estimate, shortened because this household has thrown this food out early before;
 * sniff = pushed back a little after the user checked the food (never for high-risk food); default = legacy (data saved by older versions).
 */
export type ExpirySource = 'model' | 'category' | 'user' | 'package' | 'learned' | 'sniff' | 'default';

/** Days of storage per section; null = should not be stored there. */
export type Life = Record<Zone, number | null>;

export interface Item {
  id: string;
  name: string;
  /** Photo the user took of this item (file:// on Android, data: URI on web). */
  photoUri?: string;
  category: Category;
  zone: Zone;
  highRisk: boolean;
  /** Amount bought, in `unit`: 12 (pcs) of eggs, 1 (kg) of tomatoes. What's left is qty × fraction. */
  qty: number;
  unit: Unit;
  /** Price in integer minor units (cents, paisa) of `currency`. */
  priceMinor: number;
  currency: string;
  purchased: IsoDate;
  expires: IsoDate;
  shelfDays: number;
  expirySource: ExpirySource;
  /** False while the date is only our estimate; the user is asked to check it against the package. */
  expiryConfirmed: boolean;
  status: 'active' | 'used' | 'discarded';
  /** Share of the item still left, 0..1. */
  fraction: number;
  /** Shelf life per section from Gemini; used when the item moves. Missing = category fallback. */
  life?: Life;
  /** A pack lasts several meals (eggs, milk, rice): cooking uses half instead of all of it. */
  multiUse?: boolean;
  /** Short storage tip from Gemini. */
  tip?: string;
  /** How many times a "still looks fine" check pushed the date back (capped, see expiry.ts). */
  sniffs?: number;
}

export interface Receipt {
  id: string;
  store: string;
  date: IsoDate;
  currency: string;
  totalMinor: number;
}

export interface ItemEvent {
  id: string;
  type: 'used' | 'discarded';
  name: string;
  category: Category;
  photoUri?: string;
  minor: number;
  currency: string;
  /** How much was used or thrown away, in `unit` (missing for history saved by older versions). */
  amount?: number;
  unit?: Unit;
  /** Stage at the moment of use or discard. Drives "waste avoided". */
  stage: Stage;
  date: IsoDate;
  purchased?: IsoDate;
  /** Shelf life the item had, so the learning loop can compare how long it really lasted. */
  shelfDays?: number;
  /** Discarded because it went bad before its date (not just unwanted). Feeds the learning loop. */
  wentOff?: boolean;
  /** A use that finished the item: a candidate for the shopping list. */
  finished?: boolean;
}

/** One line on the shared shopping list. */
export interface ShoppingItem {
  id: string;
  name: string;
  /** Free text: "2", "500 g", "a big bunch". */
  amount: string;
  checked: boolean;
  source: 'manual' | 'plan' | 'used-up';
  added: IsoDate;
}

/** A meal planned for a day: a TheMealDB recipe or the user's own ("Leftover soup"). */
export interface PlanEntry {
  id: string;
  date: IsoDate;
  title: string;
  recipeId?: string;
  thumb?: string | null;
  sourceUrl?: string;
  ingredients: { name: string; measure: string; staple: boolean }[];
  /** Fridge items this meal will use. */
  itemIds: string[];
  cooked: boolean;
}

export interface Money {
  minor: number;
  currency: string;
}

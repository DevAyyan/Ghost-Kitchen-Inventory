import type { Diet } from '@/lib/domain/diets';
import type { ProductInfo } from '@/lib/domain/product-info';
import type { Category } from '@/lib/domain/types';
import { useSettings } from '@/lib/store/settings-store';
import { Platform } from 'react-native';
import type { Avatar, Prefs } from '@/lib/domain/profile';
import { sessionToken, useAuthStore } from '@/lib/store/auth-store';
import { demoReply, DemoUnavailable } from '@/lib/demo/replay';

export type { ProductInfo };

export interface ScanLine {
  sourceLine: number; raw: string; name: string; quantity: number; unit: 'pcs' | 'kg' | 'g' | 'l' | 'ml'; price: number;
  category: Category; isFood: boolean; confidence: number;
}
export interface ScanResult {
  store: string | null; date: string | null;
  currency: { code: string | null; symbol: string | null; confidence: number; evidence: string[] };
  subtotal: number | null; tax: number | null; total: number | null;
  lines: ScanLine[]; source: 'gemini' | 'rules';
  ocr: { lineCount: number; avgConfidence: number }; warnings: string[];
}

export interface ItemPhotoResult {
  lines: { name: string; quantity: number; unit: 'pcs' | 'kg' | 'g' | 'l' | 'ml'; category: Category; confidence: number; expires: string | null }[];
  warnings: string[];
}
export interface TonightIdea { title: string; pitch: string; uses: string[]; source: 'gemini' | 'template' }

export interface RecipeIngredient { name: string; measure: string; staple: boolean; inStock: boolean; itemId: string | null }
export interface RemoteRecipe {
  id: string; title: string; category: string | null; area: string | null; tags: string[];
  thumb: string | null; youtube: string | null; sourceUrl: string; steps: string[];
  ingredients: RecipeIngredient[]; rescuesItemIds: string[]; missing: string[]; score: number;
  /** Amount of each matched fridge item the recipe calls for, in that item's unit, when the server could read it. */
  uses?: Record<string, { amount: number; unit: 'pcs' | 'kg' | 'g' | 'l' | 'ml' }>;
}
export interface SuggestResult {
  recipes: RemoteRecipe[];
  warnings: string[];
  page: { number: number; size: number; total: number; pages: number };
  meta: { seeds: string[]; unmatchedSeeds: string[]; candidates: number };
}
export interface RatesResult { base: string; date: string; rates: Record<string, number>; stale: boolean }
export interface ServerStatus {
  ok: boolean; db: boolean; ocr: boolean;
  ai: { enabled: boolean; model: string; usedToday: number; limitPerDay: number };
  recipes: { provider: string; keyType: 'test' | 'supporter' };
  /** Sign-in this server asks for. Missing on servers from before accounts (= none). */
  auth?: ServerAuth;
}
export type ServerAuth = { provider: 'clerk'; publishableKey: string } | { provider: 'none' };

export interface ProfileJSON { id: string; displayName: string; avatar: Avatar; prefs: Prefs; createdAt: string }
export interface HouseholdMember { userId: string; role: 'owner' | 'member'; displayName: string; avatar: Avatar; you: boolean }

export type SyncCollection = 'items' | 'events' | 'receipts' | 'shopping' | 'plan';
export interface SyncChange { collection: SyncCollection; id: string; updatedAt: number; deleted: boolean; data: Record<string, unknown> | null }
export interface SyncResponse { name: string; members: number; changes: (SyncChange & { seq: number })[]; cursor: number; more: boolean; serverTime: number }
export interface HouseholdJoin { householdId: string; name: string; key: string }

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

const BUILD_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Server base URL: Settings, then the build-time default; on web an empty value means "same origin". */
export function apiBase(): string {
  const configured = (useSettings.getState().settings.apiUrl || BUILD_URL).trim().replace(/\/+$/, '');
  if (configured) return configured;
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
}

/** Demo mode answers from recorded data, so it counts as a working server. */
export const isApiConfigured = () => useSettings.getState().settings.demoMode || apiBase() !== '';

async function request<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  if (useSettings.getState().settings.demoMode) {
    try {
      return (await demoReply(path, init)) as T;
    } catch (e) {
      if (e instanceof DemoUnavailable) throw new ApiError(e.code, e.message, 0);
      throw e;
    }
  }
  const base = apiBase();
  if (!base) throw new ApiError('not_configured', 'Set your Ghost Kitchen server address in Settings.', 0);
  const headers = new Headers(init.headers);
  // Signed in: the Clerk session. Otherwise the optional shared server token from Settings.
  const token = (await sessionToken()) ?? useSettings.getState().settings.apiToken.trim();
  if (token) headers.set('authorization', `Bearer ${token}`);
  // AbortSignal.timeout isn't available on every React Native engine, so time out by hand.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, init.timeoutMs ?? 30_000);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...init, headers, signal: controller.signal });
  } catch {
    throw new ApiError(timedOut ? 'timeout' : 'offline', timedOut ? 'The server took too long to answer.' : "Can't reach the server. Check your connection and the server address in Settings.", 0);
  } finally {
    clearTimeout(timer);
  }
  const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
  if (!res.ok) {
    // The session ran out: the app keeps working on this device, and asks to sign in again to sync.
    if (body?.error?.code === 'signed_out') useAuthStore.getState().set({ needsSignIn: true });
    throw new ApiError(body?.error?.code ?? 'http_error', body?.error?.message ?? `Server error (HTTP ${res.status}).`, res.status);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
});

/** Household requests carry the device's household key in its own header (the API token stays in authorization). */
const withKey = (key: string, init: RequestInit, timeoutMs: number): RequestInit & { timeoutMs: number } => ({
  ...init, timeoutMs, headers: { ...(init.headers as Record<string, string>), 'x-household-key': key },
});

export const api = {
  status: () => request<ServerStatus>('/v1/status', { timeoutMs: 8_000 }),

  /** `image` is a file:// uri on Android/iOS, or a Blob on web. */
  async scanReceipt(image: { uri: string } | Blob, useAi: boolean): Promise<ScanResult> {
    const form = new FormData();
    form.append('useAi', String(useAi));
    if (image instanceof Blob) form.append('image', image, 'receipt.jpg');
    // React Native's FormData accepts { uri, name, type } for files.
    else form.append('image', { uri: image.uri, name: 'receipt.jpg', type: 'image/jpeg' } as unknown as Blob);
    return request<ScanResult>('/v1/receipts/scan', { method: 'POST', body: form, timeoutMs: 90_000 });
  },

  /** Close-up photo of one food item. Needs AI on the server. */
  async scanItem(image: { uri: string } | Blob): Promise<ItemPhotoResult> {
    const form = new FormData();
    if (image instanceof Blob) form.append('image', image, 'item.jpg');
    else form.append('image', { uri: image.uri, name: 'item.jpg', type: 'image/jpeg' } as unknown as Blob);
    return request<ItemPhotoResult>('/v1/items/scan', { method: 'POST', body: form, timeoutMs: 90_000 });
  },

  tonight: (body: { items: { name: string; daysLeft: number; highRisk: boolean }[]; diets: Diet[]; useAi: boolean }) =>
    request<TonightIdea>('/v1/tonight', { ...json(body), timeoutMs: 45_000 }),

  /** Gemini's reading of a sentence the app's own parser couldn't match. Nothing is applied by the server. */
  voiceParse: (body: { text: string; items: { id: string; name: string; unit: 'pcs' | 'kg' | 'g' | 'l' | 'ml'; left: number }[] }) =>
    request<{ actions: { itemId: string; kind: 'used' | 'binned'; amount: number | null }[]; source: 'gemini' | 'none' }>('/v1/voice/parse', { ...json(body), timeoutMs: 20_000 }),

  productInfo: (names: string[], useAi: boolean) =>
    request<{ products: Record<string, ProductInfo | null>; ai: string }>('/v1/products/info', { ...json({ names, useAi }), timeoutMs: 90_000 }),

  suggestRecipes: (body: { items: { id: string; name: string; unit: 'pcs' | 'kg' | 'g' | 'l' | 'ml'; urgency: number }[]; diets: Diet[]; limit: number; page: number; seed: number; seen: string[]; useAi: boolean }) =>
    request<SuggestResult>('/v1/recipes/suggest', { ...json(body), timeoutMs: 90_000 }),

  createHousehold: (name: string) => request<HouseholdJoin>('/v1/households', { ...json({ name }), timeoutMs: 15_000 }),
  /** The signed-in account's kitchen, made on first use. Every device with the account gets the same one. */
  currentHousehold: () => request<HouseholdJoin & { members: number; made: boolean }>('/v1/households/current', { ...json({}), timeoutMs: 15_000 }),
  joinHousehold: (code: string) => request<HouseholdJoin>('/v1/households/join', { ...json({ code }), timeoutMs: 15_000 }),
  inviteToHousehold: (key: string) =>
    request<{ code: string; expiresAt: string }>('/v1/households/invite', withKey(key, json({}), 15_000)),
  syncHousehold: (key: string, body: { deviceId: string; since: number; changes: SyncChange[] }) =>
    request<SyncResponse>('/v1/households/sync', withKey(key, json(body), 45_000)),
  /** Held open by the server until the kitchen changes (or ~25 s pass); then this device syncs. */
  waitHousehold: (key: string, body: { deviceId: string; since: number }) =>
    request<{ changed: boolean }>('/v1/households/wait', withKey(key, json(body), 40_000)),
  leaveHousehold: (key: string) => request<{ ok: boolean; remaining: number }>('/v1/households/leave', withKey(key, json({}), 15_000)),

  me: () => request<{ profile: ProfileJSON; households: { id: string; name: string }[] }>('/v1/me', { timeoutMs: 15_000 }),
  updateMe: (patch: { displayName?: string; avatar?: Avatar; prefs?: Prefs }) =>
    request<{ profile: ProfileJSON }>('/v1/me', { ...json(patch), timeoutMs: 15_000 }),
  deleteMe: () => request<{ ok: boolean }>('/v1/me/delete', { ...json({}), timeoutMs: 15_000 }),
  myHouseholds: () => request<{ households: { id: string; name: string; role: 'owner' | 'member' }[] }>('/v1/households/mine', { timeoutMs: 15_000 }),
  claimHousehold: (key: string) => request<HouseholdJoin>('/v1/households/claim', withKey(key, json({}), 15_000)),
  householdMembers: (key: string) =>
    request<{ people: HouseholdMember[]; devices: number }>('/v1/households/members', withKey(key, json({}), 15_000)),
  removeMember: (key: string, userId: string) =>
    request<{ ok: boolean; remaining: number }>('/v1/households/remove', withKey(key, json({ userId }), 15_000)),

  rates: (base: string) => request<RatesResult>(`/v1/rates?base=${encodeURIComponent(base)}`, { timeoutMs: 15_000 }),

  /** Product name and type for a grocery barcode, from Open Food Facts via the server. */
  barcode: (code: string) => request<BarcodeProduct>(`/v1/barcodes/${encodeURIComponent(code)}`, { timeoutMs: 15_000 }),
};

export interface BarcodeProduct {
  code: string;
  name: string;
  brand: string | null;
  category: string;
  qty: number | null;
  unit: 'pcs' | 'kg' | 'g' | 'l' | 'ml' | null;
}

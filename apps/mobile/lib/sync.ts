import { deleteFoodPhoto } from '@/lib/photos';
import { useAuthStore } from '@/lib/store/auth-store';
import { useSettings } from '@/lib/store/settings-store';
import { api, ApiError, isApiConfigured, type SyncChange, type SyncCollection } from '@/lib/api';
import { CATEGORIES, HIGH_RISK_CATEGORIES, ZONE_ORDER } from '@/lib/domain/catalog';
import type { Category, Item, Stage } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { useHousehold } from '@/lib/store/household-store';
import { toast } from '@/lib/store/toast';
import { AppState } from 'react-native';
import { changedZones } from '@/lib/domain/kitchen-scene';
import { useKitchenPulse } from '@/lib/store/kitchen-pulse';

/**
 * Shared-household sync. Every device keeps a full copy and works offline; changes travel through the
 * Ghost Kitchen server. Each record (an item, a history entry, a shopping line…) is last-write-wins by
 * the time it changed. Photos stay on the device that took them.
 */

const COLLECTIONS: SyncCollection[] = ['items', 'events', 'receipts', 'shopping', 'plan'];
type Rec = { id: string } & Record<string, unknown>;
type Data = Pick<ReturnType<typeof useApp.getState>, SyncCollection>;

const PUSH_BATCH = 400;
// Short, so the others hear soon, but long enough to send a burst of edits (cooking a recipe) together.
const PUSH_DELAY_MS = 600;
/** How often an open app checks for changes made on other devices. */
const POLL_MS = 10_000;

const pendingKey = (c: SyncCollection, id: string) => `${c}:${id}`;
const records = (s: Data, c: SyncCollection) => s[c] as unknown as Rec[];

/**
 * How far this device's clock is from the server's, learned from each sync reply. Edits are stamped in
 * server time, so last-write-wins compares like with like: a phone whose clock is ten minutes slow no
 * longer loses every conflict, nor wins them when it runs fast.
 */
let clockOffset = 0;
// Whole milliseconds: the offset is an average, so it has a fraction, and the server only takes integers.
const syncNowMs = () => Math.round(Date.now() + clockOffset);

function learnClock(sentAt: number, receivedAt: number, serverTime: number) {
  if (!Number.isFinite(serverTime)) return;
  // The server's time was read somewhere in the round trip; assume the middle.
  const estimate = serverTime - (sentAt + receivedAt) / 2;
  // Smooth over several replies so one slow request can't swing it.
  clockOffset = clockOffset === 0 ? estimate : clockOffset * 0.7 + estimate * 0.3;
}

/** Fields that only make sense on this device. */
function toWire(r: Rec): Record<string, unknown> {
  const { photoUri: _photo, ...rest } = r;
  return rest;
}

// ---- Validation: other devices are trusted members, but stored data must still have the right shape.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STAGES: Stage[] = ['fresh', 'aging', 'expiring', 'rotting', 'spoiled'];
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const iso = (v: unknown): v is string => typeof v === 'string' && ISO.test(v);

function valid(c: SyncCollection, d: Record<string, unknown>): Rec | null {
  if (!str(d.id, 64)) return null;
  switch (c) {
    case 'items': {
      const ok = str(d.name, 80) && CATEGORIES.includes(d.category as Category) && ZONE_ORDER.includes(d.zone as Item['zone'])
        && num(d.qty) && d.qty > 0 && num(d.fraction) && d.fraction >= 0 && d.fraction <= 1 && num(d.priceMinor) && str(d.currency, 3)
        && iso(d.purchased) && iso(d.expires) && num(d.shelfDays) && ['active', 'used', 'discarded'].includes(d.status as string);
      // The high-risk floor holds whatever another device sent.
      return ok ? ({ ...d, highRisk: d.highRisk === true || HIGH_RISK_CATEGORIES.has(d.category as Category) } as unknown as Rec) : null;
    }
    case 'events':
      return (d.type === 'used' || d.type === 'discarded') && str(d.name, 80) && CATEGORIES.includes(d.category as Category)
        && num(d.minor) && str(d.currency, 3) && STAGES.includes(d.stage as Stage) && iso(d.date)
        && (d.by === undefined || str(d.by, 64)) ? (d as Rec) : null;
    case 'receipts':
      return str(d.store, 120) && iso(d.date) && str(d.currency, 3) && num(d.totalMinor) ? (d as Rec) : null;
    case 'shopping':
      return str(d.name, 80) && str(d.amount, 40) && typeof d.checked === 'boolean' && iso(d.added) ? (d as Rec) : null;
    case 'plan':
      return iso(d.date) && str(d.title, 120) && Array.isArray(d.ingredients) && Array.isArray(d.itemIds)
        && (d.itemIds as unknown[]).every((x) => str(x, 64)) && typeof d.cooked === 'boolean' ? (d as Rec) : null;
  }
}

// ---- Local change tracking.
let applyingRemote = false;

function markChanged(prev: Data, next: Data) {
  const { household, pending } = useHousehold.getState();
  if (!household) return false;
  const now = syncNowMs();
  let changed = false;
  const out = { ...pending };
  for (const c of COLLECTIONS) {
    const before = records(prev, c);
    const after = records(next, c);
    if (before === after) continue;
    const old = new Map(before.map((r) => [r.id, r]));
    for (const r of after) {
      if (old.get(r.id) !== r) { out[pendingKey(c, r.id)] = now; changed = true; }
      old.delete(r.id);
    }
    for (const id of old.keys()) { out[pendingKey(c, id)] = now; changed = true; }
  }
  if (changed) useHousehold.getState().set({ pending: out });
  return changed;
}

/** After joining, everything already on this device is offered to the household. */
function markAllPending() {
  const s = useApp.getState();
  const now = syncNowMs();
  const pending: Record<string, number> = {};
  for (const c of COLLECTIONS) for (const r of records(s, c)) pending[pendingKey(c, r.id)] = now;
  useHousehold.getState().set({ pending });
}

const ORDER: Partial<Record<SyncCollection, (a: Rec, b: Rec) => number>> = {
  events: (a, b) => String(b.date).localeCompare(String(a.date)),
  receipts: (a, b) => String(b.date).localeCompare(String(a.date)),
  plan: (a, b) => String(a.date).localeCompare(String(b.date)),
};

function applyRemote(changes: SyncChange[]) {
  if (!changes.length) return;
  const { pending } = useHousehold.getState();
  const state = useApp.getState();
  const maps = new Map<SyncCollection, Map<string, Rec>>();
  const mapFor = (c: SyncCollection) => {
    let m = maps.get(c);
    if (!m) { m = new Map(records(state, c).map((r) => [r.id, r])); maps.set(c, m); }
    return m;
  };
  for (const ch of changes) {
    if (!COLLECTIONS.includes(ch.collection)) continue;
    // Our own newer edit wins; it goes up on the next push.
    if ((pending[pendingKey(ch.collection, ch.id)] ?? 0) > ch.updatedAt) continue;
    const m = mapFor(ch.collection);
    if (ch.deleted || !ch.data) { m.delete(ch.id); continue; }
    const rec = valid(ch.collection, { ...ch.data, id: ch.id });
    if (!rec) continue;
    const local = m.get(ch.id);
    if (local?.photoUri) rec.photoUri = local.photoUri;
    m.set(ch.id, rec);
  }
  const patch: Partial<Data> = {};
  for (const [c, m] of maps) {
    const list = [...m.values()];
    const sort = ORDER[c];
    (patch as Record<string, Rec[]>)[c] = sort ? list.sort(sort) : list;
  }
  applyingRemote = true;
  try { useApp.setState(patch as never); } finally { applyingRemote = false; }
  // Show it on the kitchen: the doors whose food a housemate changed rattle.
  if (patch.items) useKitchenPulse.getState().pulse(changedZones(state.items, patch.items as Item[]));
}

// ---- Push and pull.
let inflight: Promise<void> | null = null;
let again = false;

async function runOnce() {
  const hh = useHousehold.getState();
  // Demo mode has no server to sync with; changes wait and go up once it's off.
  if (!hh.household || !isApiConfigured() || useSettings.getState().settings.demoMode) return;
  const key = hh.household.key;
  hh.set({ syncing: true });
  try {
    for (let round = 0; round < 20; round++) {
      const { pending, cursor, deviceId } = useHousehold.getState();
      const batch = Object.entries(pending).slice(0, PUSH_BATCH);
      const state = useApp.getState();
      const byColl = new Map(COLLECTIONS.map((c) => [c, new Map(records(state, c).map((r) => [r.id, r]))]));
      const changes: SyncChange[] = batch.flatMap(([k, at]) => {
        const i = k.indexOf(':');
        const c = k.slice(0, i) as SyncCollection;
        const id = k.slice(i + 1);
        if (!byColl.has(c)) return [];
        const rec = byColl.get(c)!.get(id);
        // Rounded again here: stamps saved by earlier versions can still have a fraction.
        const updatedAt = Math.max(0, Math.round(at));
        return [rec ? { collection: c, id, updatedAt, deleted: false, data: toWire(rec) } : { collection: c, id, updatedAt, deleted: true, data: null }];
      });
      const sentAt = Date.now();
      const res = await api.syncHousehold(key, { deviceId, since: cursor, changes });
      learnClock(sentAt, Date.now(), res.serverTime);
      // Drop what was pushed, unless it changed again while the request was out.
      const now = useHousehold.getState().pending;
      const left = { ...now };
      for (const [k, at] of batch) if (left[k] === at) delete left[k];
      useHousehold.getState().set({ pending: left });
      applyRemote(res.changes);
      const cur = useHousehold.getState();
      if (cur.household) cur.set({ cursor: res.cursor, household: { ...cur.household, name: res.name || cur.household.name, members: res.members } });
      if (!res.more && Object.keys(left).length === 0) break;
    }
    useHousehold.getState().set({ lastSyncAt: Date.now(), lastError: null });
  } catch (e) {
    const err = e instanceof ApiError ? e : null;
    if (err?.code === 'household_unauthorized' && followAccount && useAuthStore.getState().me) {
      // Signed in, a refusal means the account moved (another of its devices joined, left or deleted
      // everything): follow it to wherever it is now, rather than going it alone.
      useHousehold.getState().set({ lastError: null });
      void followAccount();
    } else if (err?.code === 'household_unauthorized') {
      useHousehold.getState().set({ household: null, pending: {}, cursor: 0, lastError: null });
      toast('This device was removed from the household. Your food stays here.');
    } else {
      useHousehold.getState().set({ lastError: err?.message ?? 'Sharing failed. It will try again shortly.' });
    }
  } finally {
    useHousehold.getState().set({ syncing: false });
  }
}

/** One sync at a time; a request made meanwhile runs once more afterwards. */
export function syncNow(): Promise<void> {
  if (inflight) { again = true; return inflight; }
  inflight = (async () => {
    try {
      do { again = false; await runOnce(); } while (again);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Keeps one "tell me when my kitchen changes" request waiting at the server while the app is open, and
 * syncs the moment it's answered, so a change made on another device (or by another person) shows here
 * within a moment, without reloading. Stops while the app is in the background; polling is the fallback.
 */
let watching = false;
async function watch() {
  if (watching) return;
  watching = true;
  try {
    while (AppState.currentState === 'active') {
      const hh = useHousehold.getState();
      if (!hh.household || !isApiConfigured() || useSettings.getState().settings.demoMode) break;
      try {
        const { changed } = await api.waitHousehold(hh.household.key, { deviceId: hh.deviceId, since: hh.cursor });
        if (changed) await syncNow();
      } catch (e) {
        // Refused: sync finds out why (left, removed, the account moved) and follows. Offline: wait a bit.
        if (e instanceof ApiError && e.code === 'household_unauthorized') void syncNow();
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  } finally {
    watching = false;
  }
}

/** Starts tracking, polling and foreground syncs. Call once, after the stores have loaded. */
export function startHouseholdSync(): () => void {
  const unsub = useApp.subscribe((next, prev) => {
    if (applyingRemote) return;
    if (markChanged(prev, next)) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => void syncNow(), PUSH_DELAY_MS);
    }
  });
  const poll = setInterval(() => { if (AppState.currentState === 'active') void syncNow(); }, POLL_MS);
  const app = AppState.addEventListener('change', (s) => { if (s === 'active') { void syncNow(); void watch(); } });
  // A kitchen joined, switched or left: wait on the new one.
  const unsubHh = useHousehold.subscribe((next, prev) => { if (next.household?.key !== prev.household?.key) void watch(); });
  void syncNow();
  void watch();
  return () => { unsub(); unsubHh(); clearInterval(poll); app.remove(); clearTimeout(pushTimer); };
}

// ---- Joining and leaving.
/**
 * Empties this device without telling the kitchen, so nobody else's food is deleted. Used just before
 * leaving a shared kitchen; a plain clear would sync every deletion to everyone in it.
 */
export function clearAllDataLocally() {
  applyingRemote = true;
  try { useApp.getState().clearAllData(); } finally { applyingRemote = false; }
}

/** Set by the account code (account.ts), which knows how to find the account's kitchen. */
let followAccount: (() => Promise<void>) | null = null;
export function setAccountFollower(fn: (() => Promise<void>) | null) { followAccount = fn; }

/**
 * Takes a kitchen exactly as it is on the server, replacing this device's copy of the one it was in.
 * Photos stay on the phone that took them, so they're put back on the items that come back.
 */
export async function switchTo(join: { householdId: string; name: string; key: string }) {
  const photos = new Map(useApp.getState().items.flatMap((i) => (i.photoUri ? [[i.id, i.photoUri] as const] : [])));
  applyingRemote = true;
  try { useApp.setState({ items: [], receipts: [], events: [], shopping: [], plan: [] }); } finally { applyingRemote = false; }
  useHousehold.getState().set({ household: { id: join.householdId, name: join.name, key: join.key, members: 1 }, cursor: 0, pending: {}, lastError: null });
  await syncNow();
  const items = useApp.getState().items;
  const back = new Set(items.map((i) => i.id));
  applyingRemote = true;
  try { useApp.setState({ items: items.map((i) => (!i.photoUri && photos.has(i.id) ? { ...i, photoUri: photos.get(i.id) } : i)) }); } finally { applyingRemote = false; }
  for (const [id, uri] of photos) if (!back.has(id)) deleteFoodPhoto(uri);
}

export async function adopt(join: { householdId: string; name: string; key: string }) {
  useHousehold.getState().set({ household: { id: join.householdId, name: join.name, key: join.key, members: 1 }, cursor: 0, lastError: null });
  markAllPending();
  await syncNow();
}

export async function createHousehold(name: string) {
  await adopt(await api.createHousehold(name.trim()));
}

export async function joinHousehold(code: string) {
  await adopt(await api.joinHousehold(code.replace(/[\s-]/g, '').toUpperCase()));
}

export async function inviteCode() {
  const hh = useHousehold.getState().household;
  if (!hh) throw new ApiError('no_household', 'Create or join a household first.', 0);
  return api.inviteToHousehold(hh.key);
}

/** This device stops sharing and keeps its copy. Returns false if the server couldn't be told. */
export async function leaveHousehold(): Promise<boolean> {
  const hh = useHousehold.getState().household;
  if (!hh) return true;
  let told = true;
  try { await api.leaveHousehold(hh.key); } catch { told = false; }
  useHousehold.getState().set({ household: null, pending: {}, cursor: 0, lastError: null, lastSyncAt: null });
  // Signed in, the account always has a kitchen: leaving a shared one moves it (and every device it's
  // signed in on) to one of its own, taking this device's copy of the food along.
  if (told && followAccount && useAuthStore.getState().me) await followAccount();
  return told;
}

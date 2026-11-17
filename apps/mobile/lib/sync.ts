import { api, ApiError, isApiConfigured, type SyncChange, type SyncCollection } from '@/lib/api';
import { CATEGORIES, HIGH_RISK_CATEGORIES, ZONE_ORDER } from '@/lib/domain/catalog';
import type { Category, Item, Stage } from '@/lib/domain/types';
import { useApp } from '@/lib/store/app-store';
import { useHousehold } from '@/lib/store/household-store';
import { toast } from '@/lib/store/toast';
import { AppState } from 'react-native';

/**
 * Shared-household sync. Every device keeps a full copy and works offline; changes travel through the
 * Ghost Kitchen server. Each record (an item, a history entry, a shopping line…) is last-write-wins by
 * the time it changed. Photos stay on the device that took them.
 */

const COLLECTIONS: SyncCollection[] = ['items', 'events', 'receipts', 'shopping', 'plan'];
type Rec = { id: string } & Record<string, unknown>;
type Data = Pick<ReturnType<typeof useApp.getState>, SyncCollection>;

const PUSH_BATCH = 400;
const PUSH_DELAY_MS = 1500;
const POLL_MS = 30_000;

const pendingKey = (c: SyncCollection, id: string) => `${c}:${id}`;
const records = (s: Data, c: SyncCollection) => s[c] as unknown as Rec[];

/**
 * How far this device's clock is from the server's, learned from each sync reply. Edits are stamped in
 * server time, so last-write-wins compares like with like: a phone whose clock is ten minutes slow no
 * longer loses every conflict, nor wins them when it runs fast.
 */
let clockOffset = 0;
const syncNowMs = () => Date.now() + clockOffset;

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
        && num(d.minor) && str(d.currency, 3) && STAGES.includes(d.stage as Stage) && iso(d.date) ? (d as Rec) : null;
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
}

// ---- Push and pull.
let inflight: Promise<void> | null = null;
let again = false;

async function runOnce() {
  const hh = useHousehold.getState();
  if (!hh.household || !isApiConfigured()) return;
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
        return [rec ? { collection: c, id, updatedAt: at, deleted: false, data: toWire(rec) } : { collection: c, id, updatedAt: at, deleted: true, data: null }];
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
    if (err?.code === 'household_unauthorized') {
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
  const app = AppState.addEventListener('change', (s) => { if (s === 'active') void syncNow(); });
  void syncNow();
  return () => { unsub(); clearInterval(poll); app.remove(); clearTimeout(pushTimer); };
}

// ---- Joining and leaving.
async function adopt(join: { householdId: string; name: string; key: string }) {
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
  return told;
}

import pg from 'pg';
import type { Avatar, Prefs, ProductInfo } from './schemas.js';

export interface FxSnapshot {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export const SYNC_COLLECTIONS = ['items', 'events', 'receipts', 'shopping', 'plan'] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

/** One record in a household's shared data. The server never looks inside `data`. */
export interface SyncChange {
  collection: SyncCollection;
  id: string;
  /** Client clock (ms). The newer write wins; clamped by the route so a wrong clock can't win forever. */
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown> | null;
}
export interface SyncRow extends SyncChange { seq: number }

export interface HouseholdRow { id: string; name: string }

/** A signed-in person (the id is Clerk's user id). Email and sign-in details stay with Clerk. */
export interface Profile {
  id: string;
  displayName: string;
  avatar: Avatar;
  prefs: Prefs;
  createdAt: string;
}

export type Role = 'owner' | 'member';
export interface MemberRow { userId: string; role: Role; displayName: string; avatar: Avatar }

/** Everything the API persists. Small on purpose: caches, a daily AI counter and shared-household data. */
export interface Store {
  getProducts(keys: string[]): Promise<Map<string, ProductInfo>>;
  putProducts(entries: [string, ProductInfo][]): Promise<void>;
  /** Atomically takes one AI request from today's budget. False when the budget is spent. */
  reserveAi(limit: number): Promise<boolean>;
  /** Gives a reserved request back (e.g. the call failed before reaching the model). */
  releaseAi(): Promise<void>;
  aiUsedToday(): Promise<number>;
  getFx(base: string): Promise<FxSnapshot | null>;
  putFx(snapshot: FxSnapshot): Promise<void>;
  /** Each device holds its own secret (only a hash is stored), so one device can leave without locking out the rest. */
  createHousehold(h: HouseholdRow, firstSecretHash: string): Promise<void>;
  getHousehold(id: string): Promise<HouseholdRow | null>;
  addMember(householdId: string, secretHash: string): Promise<void>;
  hasMember(householdId: string, secretHash: string): Promise<boolean>;
  /** Returns how many members remain (people and devices). */
  removeMember(householdId: string, secretHash: string): Promise<number>;
  /** People with an account plus devices that still use a device key. */
  memberCount(householdId: string): Promise<number>;

  getProfile(userId: string): Promise<Profile | null>;
  putProfile(p: Profile): Promise<void>;
  /** Removes the profile and the person's household memberships (not the households' data). */
  deleteProfile(userId: string): Promise<void>;
  createHouseholdForUser(h: HouseholdRow, userId: string): Promise<void>;
  addUserMember(householdId: string, userId: string, role: Role): Promise<void>;
  userRole(householdId: string, userId: string): Promise<Role | null>;
  /** Returns how many members remain (people and devices). */
  removeUserMember(householdId: string, userId: string): Promise<number>;
  listUserMembers(householdId: string): Promise<MemberRow[]>;
  userHouseholds(userId: string): Promise<HouseholdRow[]>;
  /** Removes the household, its invites and all of its shared data. */
  deleteHousehold(id: string): Promise<void>;
  createInvite(code: string, householdId: string, expiresAt: Date): Promise<void>;
  /** Single use: returns the household the code belongs to and deletes it, or null if unknown or expired. */
  takeInvite(code: string): Promise<string | null>;
  /** Last write wins per record: a change older than what is stored is ignored. */
  putSyncChanges(householdId: string, deviceId: string, changes: SyncChange[]): Promise<void>;
  /** Records changed after `since`, oldest first. */
  getSyncChanges(householdId: string, since: number, limit: number): Promise<SyncRow[]>;
  countSyncRecords(householdId: string): Promise<number>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export class PgStore implements Store {
  private pool: pg.Pool;
  constructor(databaseUrl: string, private quotaTz: string) {
    this.pool = new pg.Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS product_info (
        key text PRIMARY KEY, info jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS ai_usage (day date PRIMARY KEY, calls integer NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS fx_rates (
        base text NOT NULL, day date NOT NULL, rates jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (base, day));
      CREATE TABLE IF NOT EXISTS households (
        id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS household_members (
        household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        secret_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (household_id, secret_hash));
      CREATE TABLE IF NOT EXISTS household_invites (
        code text PRIMARY KEY, household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL);
      CREATE SEQUENCE IF NOT EXISTS sync_seq;
      CREATE TABLE IF NOT EXISTS sync_records (
        household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        collection text NOT NULL, id text NOT NULL, data jsonb, deleted boolean NOT NULL DEFAULT false,
        updated_at bigint NOT NULL, device_id text NOT NULL, seq bigint NOT NULL DEFAULT nextval('sync_seq'),
        PRIMARY KEY (household_id, collection, id));
      CREATE INDEX IF NOT EXISTS sync_records_seq ON sync_records (household_id, seq);
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY, display_name text NOT NULL, avatar jsonb NOT NULL, prefs jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE IF NOT EXISTS household_users (
        household_id text NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL CHECK (role IN ('owner', 'member')), joined_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (household_id, user_id));
      CREATE INDEX IF NOT EXISTS household_users_user ON household_users (user_id);
    `);
  }

  /** SQL for "today" in the quota time zone. The zone name is stripped to letters, so it can't inject SQL. */
  private get today() {
    return `(now() AT TIME ZONE '${this.quotaTz.replace(/[^A-Za-z_/]/g, '')}')::date`;
  }

  async getProducts(keys: string[]) {
    const out = new Map<string, ProductInfo>();
    if (keys.length === 0) return out;
    const { rows } = await this.pool.query<{ key: string; info: ProductInfo }>(
      'SELECT key, info FROM product_info WHERE key = ANY($1)', [keys]);
    for (const r of rows) out.set(r.key, r.info);
    return out;
  }

  async putProducts(entries: [string, ProductInfo][]) {
    for (const [key, info] of entries) {
      await this.pool.query(
        'INSERT INTO product_info (key, info) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET info = EXCLUDED.info',
        [key, JSON.stringify(info)]);
    }
  }

  async reserveAi(limit: number) {
    const { rowCount } = await this.pool.query(
      `INSERT INTO ai_usage (day, calls) VALUES (${this.today}, 1)
       ON CONFLICT (day) DO UPDATE SET calls = ai_usage.calls + 1 WHERE ai_usage.calls < $1`, [limit]);
    return (rowCount ?? 0) > 0;
  }

  async releaseAi() {
    await this.pool.query(`UPDATE ai_usage SET calls = GREATEST(calls - 1, 0) WHERE day = ${this.today}`);
  }

  async aiUsedToday() {
    const { rows } = await this.pool.query<{ calls: number }>(`SELECT calls FROM ai_usage WHERE day = ${this.today}`);
    return rows[0]?.calls ?? 0;
  }

  async getFx(base: string) {
    const { rows } = await this.pool.query<{ day: string; rates: Record<string, number> }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, rates FROM fx_rates WHERE base = $1 ORDER BY day DESC LIMIT 1`, [base]);
    return rows[0] ? { base, date: rows[0].day, rates: rows[0].rates } : null;
  }

  async putFx(s: FxSnapshot) {
    await this.pool.query(
      `INSERT INTO fx_rates (base, day, rates) VALUES ($1, $2, $3)
       ON CONFLICT (base, day) DO UPDATE SET rates = EXCLUDED.rates, fetched_at = now()`,
      [s.base, s.date, JSON.stringify(s.rates)]);
  }

  async createHousehold(h: HouseholdRow, firstSecretHash: string) {
    await this.pool.query('INSERT INTO households (id, name) VALUES ($1, $2)', [h.id, h.name]);
    await this.addMember(h.id, firstSecretHash);
  }

  async getHousehold(id: string) {
    const { rows } = await this.pool.query<HouseholdRow>('SELECT id, name FROM households WHERE id = $1', [id]);
    return rows[0] ?? null;
  }

  async addMember(householdId: string, secretHash: string) {
    await this.pool.query('INSERT INTO household_members (household_id, secret_hash) VALUES ($1, $2)', [householdId, secretHash]);
  }

  async hasMember(householdId: string, secretHash: string) {
    const { rowCount } = await this.pool.query('SELECT 1 FROM household_members WHERE household_id = $1 AND secret_hash = $2', [householdId, secretHash]);
    return (rowCount ?? 0) > 0;
  }

  async removeMember(householdId: string, secretHash: string) {
    await this.pool.query('DELETE FROM household_members WHERE household_id = $1 AND secret_hash = $2', [householdId, secretHash]);
    return this.memberCount(householdId);
  }

  async memberCount(householdId: string) {
    const { rows } = await this.pool.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM household_members WHERE household_id = $1)
            + (SELECT count(*) FROM household_users WHERE household_id = $1) AS n`, [householdId]);
    return Number(rows[0]?.n ?? 0);
  }

  async getProfile(userId: string) {
    const { rows } = await this.pool.query<{ id: string; display_name: string; avatar: Avatar; prefs: Prefs; created_at: Date }>(
      'SELECT id, display_name, avatar, prefs, created_at FROM users WHERE id = $1', [userId]);
    const r = rows[0];
    return r ? { id: r.id, displayName: r.display_name, avatar: r.avatar, prefs: r.prefs, createdAt: r.created_at.toISOString() } : null;
  }

  async putProfile(p: Profile) {
    await this.pool.query(
      `INSERT INTO users (id, display_name, avatar, prefs) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, avatar = EXCLUDED.avatar, prefs = EXCLUDED.prefs`,
      [p.id, p.displayName, JSON.stringify(p.avatar), JSON.stringify(p.prefs)]);
  }

  async deleteProfile(userId: string) {
    await this.pool.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  async createHouseholdForUser(h: HouseholdRow, userId: string) {
    await this.pool.query('INSERT INTO households (id, name) VALUES ($1, $2)', [h.id, h.name]);
    await this.addUserMember(h.id, userId, 'owner');
  }

  async addUserMember(householdId: string, userId: string, role: Role) {
    await this.pool.query(
      'INSERT INTO household_users (household_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [householdId, userId, role]);
  }

  async userRole(householdId: string, userId: string) {
    const { rows } = await this.pool.query<{ role: Role }>(
      'SELECT role FROM household_users WHERE household_id = $1 AND user_id = $2', [householdId, userId]);
    return rows[0]?.role ?? null;
  }

  async removeUserMember(householdId: string, userId: string) {
    await this.pool.query('DELETE FROM household_users WHERE household_id = $1 AND user_id = $2', [householdId, userId]);
    return this.memberCount(householdId);
  }

  async listUserMembers(householdId: string) {
    const { rows } = await this.pool.query<{ user_id: string; role: Role; display_name: string; avatar: Avatar }>(
      `SELECT hu.user_id, hu.role, u.display_name, u.avatar FROM household_users hu JOIN users u ON u.id = hu.user_id
       WHERE hu.household_id = $1 ORDER BY hu.joined_at`, [householdId]);
    return rows.map((r) => ({ userId: r.user_id, role: r.role, displayName: r.display_name, avatar: r.avatar }));
  }

  async userHouseholds(userId: string) {
    const { rows } = await this.pool.query<HouseholdRow>(
      `SELECT h.id, h.name FROM households h JOIN household_users hu ON hu.household_id = h.id
       WHERE hu.user_id = $1 ORDER BY hu.joined_at`, [userId]);
    return rows;
  }

  async deleteHousehold(id: string) {
    await this.pool.query('DELETE FROM households WHERE id = $1', [id]);
  }

  async createInvite(code: string, householdId: string, expiresAt: Date) {
    await this.pool.query('DELETE FROM household_invites WHERE expires_at < now()');
    await this.pool.query('INSERT INTO household_invites (code, household_id, expires_at) VALUES ($1, $2, $3)', [code, householdId, expiresAt]);
  }

  async takeInvite(code: string) {
    const { rows } = await this.pool.query<{ household_id: string; live: boolean }>(
      'DELETE FROM household_invites WHERE code = $1 RETURNING household_id, expires_at > now() AS live', [code]);
    return rows[0]?.live ? rows[0].household_id : null;
  }

  async putSyncChanges(householdId: string, deviceId: string, changes: SyncChange[]) {
    for (const c of changes) {
      await this.pool.query(
        `INSERT INTO sync_records (household_id, collection, id, data, deleted, updated_at, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (household_id, collection, id) DO UPDATE
           SET data = EXCLUDED.data, deleted = EXCLUDED.deleted, updated_at = EXCLUDED.updated_at,
               device_id = EXCLUDED.device_id, seq = nextval('sync_seq')
           WHERE sync_records.updated_at <= EXCLUDED.updated_at`,
        [householdId, c.collection, c.id, c.deleted ? null : JSON.stringify(c.data), c.deleted, c.updatedAt, deviceId]);
    }
  }

  async getSyncChanges(householdId: string, since: number, limit: number) {
    const { rows } = await this.pool.query<{ collection: SyncCollection; id: string; data: Record<string, unknown> | null; deleted: boolean; updated_at: string; seq: string }>(
      `SELECT collection, id, data, deleted, updated_at, seq FROM sync_records
       WHERE household_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`, [householdId, since, limit]);
    return rows.map((r) => ({ collection: r.collection, id: r.id, data: r.data, deleted: r.deleted, updatedAt: Number(r.updated_at), seq: Number(r.seq) }));
  }

  async countSyncRecords(householdId: string) {
    const { rows } = await this.pool.query<{ n: string }>('SELECT count(*) AS n FROM sync_records WHERE household_id = $1', [householdId]);
    return Number(rows[0]?.n ?? 0);
  }

  async ping() {
    try { await this.pool.query('SELECT 1'); return true; } catch { return false; }
  }

  async close() { await this.pool.end(); }
}

/** Test double with the same semantics. */
export class MemoryStore implements Store {
  products = new Map<string, ProductInfo>();
  used = 0;
  fx = new Map<string, FxSnapshot>();
  async getProducts(keys: string[]) {
    return new Map(keys.flatMap((k) => (this.products.has(k) ? [[k, this.products.get(k)!] as const] : [])));
  }
  async putProducts(entries: [string, ProductInfo][]) { entries.forEach(([k, v]) => this.products.set(k, v)); }
  async reserveAi(limit: number) { if (this.used >= limit) return false; this.used++; return true; }
  async releaseAi() { this.used = Math.max(0, this.used - 1); }
  async aiUsedToday() { return this.used; }
  async getFx(base: string) { return this.fx.get(base) ?? null; }
  async putFx(s: FxSnapshot) { this.fx.set(s.base, s); }
  households = new Map<string, HouseholdRow>();
  invites = new Map<string, { householdId: string; expiresAt: Date }>();
  records = new Map<string, SyncRow & { householdId: string; deviceId: string }>();
  private seq = 0;
  members = new Map<string, Set<string>>();
  async createHousehold(h: HouseholdRow, firstSecretHash: string) { this.households.set(h.id, h); this.members.set(h.id, new Set([firstSecretHash])); }
  async getHousehold(id: string) { return this.households.get(id) ?? null; }
  async addMember(householdId: string, secretHash: string) { this.members.get(householdId)?.add(secretHash); }
  async hasMember(householdId: string, secretHash: string) { return this.members.get(householdId)?.has(secretHash) ?? false; }
  async removeMember(householdId: string, secretHash: string) { this.members.get(householdId)?.delete(secretHash); return this.memberCount(householdId); }
  async memberCount(householdId: string) {
    return (this.members.get(householdId)?.size ?? 0) + [...this.userMembers.values()].filter((m) => m.householdId === householdId).length;
  }
  profiles = new Map<string, Profile>();
  userMembers = new Map<string, { householdId: string; userId: string; role: Role; at: number }>();
  private joined = 0;
  async getProfile(userId: string) { return this.profiles.get(userId) ?? null; }
  async putProfile(p: Profile) { this.profiles.set(p.id, p); }
  async deleteProfile(userId: string) {
    this.profiles.delete(userId);
    for (const [k, m] of this.userMembers) if (m.userId === userId) this.userMembers.delete(k);
  }
  async createHouseholdForUser(h: HouseholdRow, userId: string) {
    this.households.set(h.id, h);
    this.members.set(h.id, new Set());
    await this.addUserMember(h.id, userId, 'owner');
  }
  async addUserMember(householdId: string, userId: string, role: Role) {
    const k = `${householdId}|${userId}`;
    if (!this.userMembers.has(k)) this.userMembers.set(k, { householdId, userId, role, at: ++this.joined });
  }
  async userRole(householdId: string, userId: string) { return this.userMembers.get(`${householdId}|${userId}`)?.role ?? null; }
  async removeUserMember(householdId: string, userId: string) { this.userMembers.delete(`${householdId}|${userId}`); return this.memberCount(householdId); }
  async listUserMembers(householdId: string) {
    return [...this.userMembers.values()].filter((m) => m.householdId === householdId && this.profiles.has(m.userId))
      .sort((a, b) => a.at - b.at)
      .map((m) => { const p = this.profiles.get(m.userId)!; return { userId: m.userId, role: m.role, displayName: p.displayName, avatar: p.avatar }; });
  }
  async userHouseholds(userId: string) {
    return [...this.userMembers.values()].filter((m) => m.userId === userId).sort((a, b) => a.at - b.at)
      .flatMap((m) => { const h = this.households.get(m.householdId); return h ? [h] : []; });
  }
  async deleteHousehold(id: string) {
    this.households.delete(id);
    this.members.delete(id);
    for (const [k, m] of this.userMembers) if (m.householdId === id) this.userMembers.delete(k);
    for (const [k, v] of this.invites) if (v.householdId === id) this.invites.delete(k);
    for (const [k, v] of this.records) if (v.householdId === id) this.records.delete(k);
  }
  async createInvite(code: string, householdId: string, expiresAt: Date) { this.invites.set(code, { householdId, expiresAt }); }
  async takeInvite(code: string) {
    const inv = this.invites.get(code);
    this.invites.delete(code);
    return inv && inv.expiresAt.getTime() > Date.now() ? inv.householdId : null;
  }
  async putSyncChanges(householdId: string, deviceId: string, changes: SyncChange[]) {
    for (const c of changes) {
      const key = `${householdId}|${c.collection}|${c.id}`;
      const prev = this.records.get(key);
      if (prev && prev.updatedAt > c.updatedAt) continue;
      this.records.set(key, { ...c, data: c.deleted ? null : c.data, seq: ++this.seq, householdId, deviceId });
    }
  }
  async getSyncChanges(householdId: string, since: number, limit: number) {
    return [...this.records.values()]
      .filter((r) => r.householdId === householdId && r.seq > since)
      .sort((a, b) => a.seq - b.seq).slice(0, limit)
      .map(({ householdId: _h, deviceId: _d, ...row }) => row);
  }
  async countSyncRecords(householdId: string) { return [...this.records.values()].filter((r) => r.householdId === householdId).length; }
  async ping() { return true; }
  async close() {}
}

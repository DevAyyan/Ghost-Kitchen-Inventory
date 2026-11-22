import { api, ApiError, type ProfileJSON } from '@/lib/api';
import { pickPrefs, prefsDiffer, type Prefs } from '@/lib/domain/profile';
import { useAuthStore, type Me } from '@/lib/store/auth-store';
import { useHousehold } from '@/lib/store/household-store';
import { useSettings, type Settings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { linkAction } from '@/lib/domain/account-link';
import { adopt, setAccountFollower, switchTo, syncNow } from '@/lib/sync';

/**
 * What happens around signing in: load (or make) the profile, bring this device's settings in line with
 * it, move an old device-key household over to the account, and keep the profile up to date afterwards.
 * Nothing here deletes food: the fridge on this device is kept through sign-in, sign-out and switching people.
 */

const toMe = (p: ProfileJSON, email?: string): Me => ({ id: p.id, displayName: p.displayName, avatar: p.avatar, prefs: p.prefs, email });

/**
 * Settings from the profile. A profile that has none yet (a first sign-in) takes this device's instead, so
 * signing in never changes how the app looks.
 */
function applyPrefs(profilePrefs: Prefs) {
  const local = pickPrefs(useSettings.getState().settings as unknown as Record<string, unknown>);
  if (Object.keys(profilePrefs).length === 0) return local;
  if (prefsDiffer(profilePrefs, local)) useSettings.getState().update(profilePrefs as Partial<Settings>);
  return null;
}

/** Called when Clerk reports a signed-in person. Safe to call again: it only does what's still needed. */
export async function onSignedIn(userId: string, email?: string) {
  const store = useAuthStore.getState();
  const switched = store.me && store.me.id !== userId;
  store.set({ needsSignIn: false });
  try {
    const { profile } = await api.me();
    const push = applyPrefs(profile.prefs);
    let me = toMe(profile, email);
    if (push) me = toMe((await api.updateMe({ prefs: push })).profile, email);
    useAuthStore.getState().set({ me });
    await linkHousehold();
  } catch (e) {
    // Offline or the server is down: keep going with what we remembered. The profile loads next time.
    if (!store.me || switched) {
      useAuthStore.getState().set({ me: { id: userId, displayName: 'New ghost', avatar: { ghost: 0, colour: 'mint' }, prefs: {}, email } });
    }
    if (!(e instanceof ApiError) || e.status === 0) return;
    toast("Couldn't load your profile. It will try again.");
  }
}

/**
 * - A device that shared through a device key (before accounts) swaps it for a membership.
 * - Otherwise the device follows the account: it shows the kitchen the server says the account is in,
 *   made the first time the account is used anywhere (see domain/account-link.ts for what that means for
 *   the food already on it).
 */
async function linkHousehold() {
  const now = useHousehold.getState().household;
  if (now?.key.includes('.')) {
    try {
      const claimed = await api.claimHousehold(now.key);
      useHousehold.getState().set({ household: { ...now, key: claimed.key } });
      toast(`${claimed.name} is now linked to your account.`);
    } catch {
      // The key no longer works: sync will notice and stop sharing, as before.
    }
    return;
  }
  await followAccount();
}

let following: Promise<void> | null = null;

/** Brings this device to the account's kitchen. One at a time; safe to call often. */
export function followAccount(): Promise<void> {
  if (following) return following;
  following = (async () => {
    try {
      if (!useAuthStore.getState().me || useSettings.getState().settings.demoMode) return;
      const cur = await api.currentHousehold();
      const join = { householdId: cur.householdId, name: cur.name, key: cur.key };
      const was = useHousehold.getState().household;
      switch (linkAction(was?.id ?? null, cur.householdId, cur.made)) {
        case 'sync': void syncNow(); break;
        case 'merge': await adopt(join); break;
        case 'replace':
          await switchTo(join);
          toast(`Showing ${cur.name}, where your account is now.`);
          break;
      }
    } catch {
      // Offline or the server is down: the next sync or app start tries again.
    } finally {
      following = null;
    }
  })();
  return following;
}

/** Signing out keeps the food on this device; the next person to sign in decides what happens to sharing. */
export function onSignedOut() {
  useAuthStore.getState().set({ me: null, needsSignIn: false });
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

/** Sends preference changes made on this device up to the profile, so the person's other devices get them. */
export function startProfileSync(): () => void {
  return useSettings.subscribe((next, prev) => {
    const me = useAuthStore.getState().me;
    if (!me) return;
    const a = pickPrefs(next.settings as unknown as Record<string, unknown>);
    if (!prefsDiffer(a, pickPrefs(prev.settings as unknown as Record<string, unknown>))) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      void api.updateMe({ prefs: a })
        .then(({ profile }) => useAuthStore.getState().set({ me: toMe(profile, me.email) }))
        .catch(() => {});
    }, 1200);
  });
}

/** Name and ghost. Returns the error message to show, or null. */
export async function saveProfile(patch: { displayName?: string; avatar?: Me['avatar'] }): Promise<string | null> {
  const me = useAuthStore.getState().me;
  if (!me) return 'Sign in first.';
  try {
    const { profile } = await api.updateMe(patch);
    useAuthStore.getState().set({ me: toMe(profile, me.email) });
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.message : 'Saving failed. Try again.';
  }
}

// Sync calls this when the server refuses this device's kitchen, so the device follows the account.
setAccountFollower(followAccount);

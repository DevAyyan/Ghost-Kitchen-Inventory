import { buildDigests } from '@/lib/domain/digest';
import { parseIso } from '@/lib/domain/dates';
import type { Item, ItemEvent, Money, Receipt } from '@/lib/domain/types';
import { hasActivity, summarizeWeek, weekMessage } from '@/lib/domain/weekly';
import { addDays, today, weekStart } from '@/lib/domain/dates';
import { Platform } from 'react-native';

const CHANNEL = 'daily-digest';

/** Local notifications exist on Android and iOS; the web build has no scheduled notifications. */
export const notificationsSupported = Platform.OS !== 'web';

async function mod() {
  return import('expo-notifications');
}

export type PermissionResult = 'granted' | 'denied' | 'unsupported';

/** Asks in context (when the user turns the digest on), never at launch. */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  if (!notificationsSupported) return 'unsupported';
  const N = await mod();
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL, { name: 'Daily "cook tonight" reminder', importance: N.AndroidImportance.DEFAULT });
  }
  const current = await N.getPermissionsAsync();
  if (current.granted) return 'granted';
  const asked = await N.requestPermissionsAsync();
  return asked.granted ? 'granted' : 'denied';
}

/**
 * Replaces everything scheduled with the next week of digests at `hour` o'clock. Cheap, so we call it
 * whenever the fridge or the setting changes. Turning the digest off cancels everything.
 */
export interface WeeklyInput { events: ItemEvent[]; receipts: Receipt[]; fmt: (m: Money[]) => string }

export async function syncDigestNotifications(
  items: Item[],
  opts: { enabled: boolean; hour: number; weekly?: WeeklyInput & { enabled: boolean } }
): Promise<number> {
  if (!notificationsSupported) return 0;
  const N = await mod();
  await N.cancelAllScheduledNotificationsAsync();
  if (!opts.enabled && !opts.weekly?.enabled) return 0;
  if (!(await N.getPermissionsAsync()).granted) return 0;

  const now = Date.now();
  let scheduled = 0;

  // Next Monday's look back at this week, from what has happened so far. Refreshed on every change, so
  // by Sunday night it covers the whole week.
  if (opts.weekly?.enabled) {
    const w = opts.weekly;
    const start = weekStart(today());
    const summary = summarizeWeek({ events: w.events, receipts: w.receipts, items, start, now: today() });
    if (hasActivity(summary)) {
      const at = parseIso(addDays(start, 7));
      at.setHours(opts.hour, 0, 0, 0);
      const msg = weekMessage(summary, w.fmt);
      await N.scheduleNotificationAsync({
        content: { title: msg.title, body: msg.body, data: { route: '/ledger' } },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
      scheduled++;
    }
  }
  if (!opts.enabled) return scheduled;

  for (const d of buildDigests(items)) {
    const at = parseIso(d.date);
    at.setHours(opts.hour, 0, 0, 0);
    if (at.getTime() <= now + 60_000) continue; // already past today's time
    await N.scheduleNotificationAsync({
      content: { title: d.title, body: d.body, data: { route: '/recipes' } },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
    scheduled++;
  }
  return scheduled;
}

/** Called from the root layout once: tapping the digest opens the recipes tab. */
export async function onDigestTapped(open: (route: string) => void): Promise<() => void> {
  if (!notificationsSupported) return () => {};
  const N = await mod();
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  const sub = N.addNotificationResponseReceivedListener((r) => {
    const route = (r.notification.request.content.data as { route?: string } | undefined)?.route;
    if (route) open(route);
  });
  return () => sub.remove();
}

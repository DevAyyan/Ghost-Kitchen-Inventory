/**
 * Signed in, the account decides which kitchen a device shows: every device with the same account shows
 * the same food. This picks what a device does once it knows the account's kitchen.
 * - sync: it's already there.
 * - merge: it wasn't in any kitchen (its first sign-in, or used signed out until now). Its food is added
 *   to the account's kitchen, so nothing on it is lost.
 * - replace: it was in another kitchen, and the account is now in one that already existed (another
 *   device joined a household, or left one and got there first). It takes that kitchen as it is.
 * - merge, too, when the account's kitchen was only just made (`made`): this device is the first to
 *   notice the account left or was removed, so it brings its copy of the food along for the others.
 */
export type LinkAction = 'sync' | 'merge' | 'replace';

export function linkAction(deviceKitchen: string | null, accountKitchen: string, made = false): LinkAction {
  if (deviceKitchen === accountKitchen) return 'sync';
  if (!deviceKitchen || made) return 'merge';
  return 'replace';
}

/** "Delete all data", signed in. Shared with other people: leave first, so their food isn't deleted. */
export const deleteAllPlan = (members: number): 'leave-then-clear' | 'clear-everywhere' =>
  members > 1 ? 'leave-then-clear' : 'clear-everywhere';

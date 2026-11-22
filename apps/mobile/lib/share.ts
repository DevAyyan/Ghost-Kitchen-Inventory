import { Platform, Share } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Shares plain text. Web: the Web Share sheet where the browser has one, otherwise the clipboard.
 * Phones: the system share sheet.
 */
export async function shareText(title: string, text: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    if (nav?.share) {
      try {
        await nav.share({ title, text });
        return 'shared';
      } catch (e) {
        return (e as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'failed';
      }
    }
    try {
      await nav?.clipboard?.writeText(text);
      return nav?.clipboard ? 'copied' : 'failed';
    } catch {
      return 'failed';
    }
  }
  try {
    const res = await Share.share({ title, message: text });
    return res.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}

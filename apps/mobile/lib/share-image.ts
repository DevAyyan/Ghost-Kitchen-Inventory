import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { ShareResult } from './share';

/**
 * Captures a view as a PNG and shares it: the system sheet on phones; on the web, Web Share with a file
 * where supported, otherwise a download. 'failed' lets the caller fall back to sharing text.
 */
export async function shareViewAsImage(ref: React.RefObject<View | null>, fileName: string, title: string): Promise<ShareResult | 'downloaded'> {
  try {
    if (!ref.current) return 'failed';
    if (Platform.OS !== 'web') {
      const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
      if (!(await Sharing.isAvailableAsync())) return 'failed';
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      new File(uri).copy(file);
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: title });
      return 'shared';
    }
    const dataUri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
    const blob = await (await fetch(dataUri)).blob();
    const png = new globalThis.File([blob], fileName, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: { files: unknown[] }) => boolean };
    if (nav.share && nav.canShare?.({ files: [png] })) {
      try {
        await nav.share({ files: [png], title });
        return 'shared';
      } catch (e) {
        if ((e as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
      }
    }
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

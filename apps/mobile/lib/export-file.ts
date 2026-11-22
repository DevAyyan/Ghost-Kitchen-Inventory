import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Hands a JSON export to the user: a download on the web, the system share sheet on a phone. Returns false if it couldn't. */
export async function deliverExport(json: string, fileName: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return true;
    }
    if (!(await Sharing.isAvailableAsync())) return false;
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    file.write(json);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Ghost Kitchen data' });
    return true;
  } catch {
    return false;
  }
}

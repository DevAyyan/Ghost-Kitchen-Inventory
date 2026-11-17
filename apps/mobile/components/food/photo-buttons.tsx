import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { type PhotoSource, captureFoodPhoto } from '@/lib/photos';
import { toast } from '@/lib/store/toast';
import { Camera, Images } from 'lucide-react-native';
import * as React from 'react';
import { Platform, View } from 'react-native';

/**
 * "Take photo" + "Choose" buttons. On web the camera button opens the file dialog (or phone camera).
 * `compact`: one 44 px camera icon button, for headers.
 */
export function PhotoButtons({ hasPhoto, onPhoto, compact }: { hasPhoto: boolean; onPhoto: (uri: string) => void; compact?: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const run = async (src: PhotoSource) => {
    setBusy(true);
    const res = await captureFoodPhoto(src);
    setBusy(false);
    if (!res) return;
    if ('error' in res) toast(res.error);
    else onPhoto(res.uri);
  };
  if (compact) {
    return (
      <Button variant="outline" size="icon" className="h-11 w-11" disabled={busy} onPress={() => run('camera')} accessibilityLabel={hasPhoto ? 'Retake photo' : 'Take a photo'}>
        <Icon as={Camera} size={18} />
      </Button>
    );
  }
  return (
    <View className="flex-row flex-wrap gap-2">
      <Button variant="outline" className="h-11" disabled={busy} onPress={() => run('camera')}>
        <Icon as={Camera} size={16} />
        <Text>{hasPhoto ? 'Retake photo' : 'Take photo'}</Text>
      </Button>
      {Platform.OS !== 'web' && (
        <Button variant="ghost" className="h-11" disabled={busy} onPress={() => run('library')}>
          <Icon as={Images} size={16} />
          <Text>Gallery</Text>
        </Button>
      )}
    </View>
  );
}

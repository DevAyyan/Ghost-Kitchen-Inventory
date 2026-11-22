import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { api, ApiError, type BarcodeProduct } from '@/lib/api';
import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import { Camera, LoaderCircle, Search } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

/** The codes printed on groceries. UPC-E is left out: it can arrive as 6 digits, which isn't a full GTIN. */
const GROCERY_CODES: BarcodeType[] = ['ean13', 'ean8', 'upc_a'];
const isCode = (s: string) => /^\d{8,14}$/.test(s);

/**
 * Point the camera at a product's barcode (or type the number under it) and get its name and type from
 * Open Food Facts. The same camera view works on Android and in the browser.
 */
export function BarcodeSheet({ open, onClose, onFound }: { open: boolean; onClose: () => void; onFound: (p: BarcodeProduct) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [typed, setTyped] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  // The camera reports the same code many times a second: look each one up once.
  const lastCode = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!open) { setTyped(''); setMessage(null); setBusy(false); lastCode.current = null; }
  }, [open]);

  const look = async (code: string) => {
    if (busy || !isCode(code)) return;
    setBusy(true);
    setMessage(null);
    try {
      onFound(await api.barcode(code));
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Couldn't look up that barcode. Try again, or add it by hand.");
      // Let the camera try the same code again after a failure.
      lastCode.current = null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveSheet open={open} onClose={onClose} title="Scan a barcode" description="Hold the barcode flat and steady in the frame.">
      {permission?.granted ? (
        <View className="bg-muted aspect-[4/3] w-full overflow-hidden rounded-lg">
          {open && (
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: GROCERY_CODES }}
              onBarcodeScanned={busy ? undefined : ({ data }) => {
                if (data === lastCode.current) return;
                lastCode.current = data;
                void look(data);
              }}
            />
          )}
        </View>
      ) : (
        <View className="border-border items-start gap-3 rounded-lg border border-dashed p-4">
          <Text className="text-sm">
            {permission && !permission.canAskAgain
              ? 'Camera access is off for Ghost Kitchen. Turn it on in your settings, or type the number below.'
              : 'Ghost Kitchen needs the camera to read barcodes. Nothing is recorded or saved.'}
          </Text>
          {(!permission || permission.canAskAgain) && (
            <Button variant="outline" className="h-11" onPress={() => void requestPermission()}>
              <Icon as={Camera} size={16} />
              <Text>Use the camera</Text>
            </Button>
          )}
        </View>
      )}

      <View className="gap-2">
        <Text className="text-sm font-semibold">Or type the number under the barcode</Text>
        <View className="flex-row gap-2">
          <Input
            value={typed}
            onChangeText={(t) => setTyped(t.replace(/\D/g, '').slice(0, 14))}
            onSubmitEditing={() => void look(typed)}
            keyboardType="number-pad"
            inputMode="numeric"
            placeholder="e.g. 5000112637922"
            accessibilityLabel="Barcode number"
            returnKeyType="search"
            className="h-11 min-w-0 flex-1"
          />
          <Button className="h-11" disabled={busy || !isCode(typed)} onPress={() => void look(typed)}>
            <Icon as={busy ? LoaderCircle : Search} size={16} className={busy ? 'text-primary-foreground animate-spin' : 'text-primary-foreground'} />
            <Text>Look up</Text>
          </Button>
        </View>
      </View>

      <View aria-live="polite">
        {busy && <Text className="text-muted-foreground text-sm">Looking it up…</Text>}
        {message && <Text className="text-destructive text-sm">{message}</Text>}
      </View>
      <Text className="text-muted-foreground text-xs">Product names come from Open Food Facts, a free, open database anyone can add to. Check the name before you add it.</Text>
    </ResponsiveSheet>
  );
}

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Screen } from '@/components/common/screen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api, ApiError, isApiConfigured } from '@/lib/api';
import { today } from '@/lib/domain/dates';
import { applyLessons, draftFromItemPhoto, draftFromScan, needsExpiry, withInfo } from '@/lib/domain/draft';
import { learnFromHistory } from '@/lib/domain/learning';
import { useLayout } from '@/lib/hooks';
import { captureReceipt, saveThumbnail, type PhotoSource, type ReceiptPhoto } from '@/lib/photos';
import { LOOKUP_MESSAGE, lookupProducts } from '@/lib/products';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { useScan } from '@/lib/store/scan-store';
import { useServer } from '@/lib/store/server-store';
import { toast } from '@/lib/store/toast';
import { useFocusEffect, useRouter } from 'expo-router';
import { Camera, CircleAlert, Images, LoaderCircle, PenLine, ReceiptText, ScanLine, Server } from 'lucide-react-native';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { Image, View } from 'react-native';

/** What the photo shows: a paper receipt, or one food item. */
type Mode = 'receipt' | 'item';

type Phase =
  | { kind: 'idle' }
  | { kind: 'reading'; photo: ReceiptPhoto; step: 'upload' | 'lookup'; mode: Mode }
  | { kind: 'error'; photo: ReceiptPhoto | null; mode: Mode; title: string; message: string };

export default function ScanScreen() {
  const router = useRouter();
  const { isPhone } = useLayout();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const storeHints = useApp((s) => s.storeHints);
  const setDraft = useScan((s) => s.setDraft);
  const markUnreachable = useServer((s) => s.markUnreachable);
  const [phase, setPhase] = React.useState<Phase>({ kind: 'idle' });
  const [noticeFor, setNoticeFor] = React.useState<{ source: PhotoSource; mode: Mode } | null>(null);
  const run = React.useRef(0);

  // Leaving the tab abandons an in-flight scan (its result is ignored).
  useFocusEffect(React.useCallback(() => () => { run.current++; setPhase({ kind: 'idle' }); }, []));

  const scan = async (photo: ReceiptPhoto, mode: Mode = 'receipt') => {
    const id = ++run.current;
    setPhase({ kind: 'reading', photo, step: 'upload', mode });
    try {
      if (mode === 'item') {
        const seen = await api.scanItem(photo.upload);
        if (id !== run.current) return;
        const cur = useSettings.getState().settings.defaultCurrency;
        // The photo doubles as the item's picture on the shelf.
        const photoUri = await saveThumbnail(photo.previewUri);
        let fd = draftFromItemPhoto(seen, { currency: cur, date: today(), photoUri });
        setPhase({ kind: 'reading', photo, step: 'lookup', mode });
        const { info } = await lookupProducts(fd.lines.map((l) => l.name));
        if (id !== run.current) return;
        // A date printed on the pack beats the estimate; the lookup only fills in the rest.
        fd = { ...fd, lines: fd.lines.map((l) => (info.has(l.name) ? withInfo(l, info.get(l.name) ?? null, fd.date) : l)) };
        setDraft(applyLessons(fd, learnFromHistory(useApp.getState().events, today())));
        setPhase({ kind: 'idle' });
        router.push('/review');
        return;
      }
      const result = await api.scanReceipt(photo.upload, !useSettings.getState().settings.tesseractOnly);
      if (id !== run.current) return;
      if (result.lines.length === 0) {
        setPhase({ kind: 'error', photo, mode, title: 'No items found', message: 'The text was read, but no product lines were recognised. Retake the photo with the whole receipt flat and in frame, or enter the items by hand.' });
        return;
      }
      const s = useSettings.getState().settings;
      let draft = draftFromScan(result, { defaultCurrency: s.defaultCurrency, storeHint: result.store ? storeHints[result.store] : undefined, date: today() });

      // Shelf life for each food line from Gemini (cached after the first time).
      setPhase({ kind: 'reading', photo, step: 'lookup', mode });
      const names = draft.lines.filter(needsExpiry).map((l) => l.name);
      const { info, status } = await lookupProducts(names);
      if (id !== run.current) return;
      draft = { ...draft, lines: draft.lines.map((l) => (info.has(l.name) ? withInfo(l, info.get(l.name) ?? null, draft.date) : l)) };
      const note = LOOKUP_MESSAGE[status];
      if (note) draft = { ...draft, warnings: [...draft.warnings, note] };
      // Foods this household keeps throwing out early get shorter estimates.
      draft = applyLessons(draft, learnFromHistory(useApp.getState().events, today()));

      setDraft(draft);
      setPhase({ kind: 'idle' });
      router.push('/review');
    } catch (e) {
      if (id !== run.current) return;
      const err = e instanceof ApiError ? e : new ApiError('unknown', 'Something went wrong while reading the receipt.', 0);
      if (err.code === 'offline' || err.code === 'not_configured') markUnreachable(err.message);
      setPhase({
        kind: 'error', photo, mode,
        title: err.code === 'nothing_seen' ? 'No food found' : err.code === 'no_text' ? "Couldn't read the receipt" : err.code === 'offline' || err.code === 'timeout' ? "Couldn't reach the server" : 'Scan failed',
        message: err.message,
      });
    }
  };

  const pick = async (source: PhotoSource, mode: Mode = 'receipt') => {
    // Read current settings: right after the privacy notice is accepted, this render's `settings` is stale.
    const current = useSettings.getState().settings;
    if (mode === 'item') {
      if (current.tesseractOnly) { toast('Item photos need AI. Turn on "Use AI" in Settings.'); return; }
      if (!current.itemPhotoNoticeSeen) { setNoticeFor({ source, mode }); return; }
    } else if (!current.aiNoticeSeen && !current.tesseractOnly) { setNoticeFor({ source, mode }); return; }
    const res = await captureReceipt(source);
    if (!res) return;
    if ('error' in res) { toast(res.error); return; }
    void scan(res, mode);
  };

  if (!isApiConfigured()) {
    return (
      <Screen needsServer title="Scan a receipt">
        <Alert icon={Server}>
          <AlertTitle>Connect to your Ghost Kitchen server</AlertTitle>
          <AlertDescription>Your Ghost Kitchen server reads receipts and photos. Add its address in Settings, or enter items by hand.</AlertDescription>
        </Alert>
        <View className="flex-row flex-wrap gap-2">
          <Button className="h-11" onPress={() => router.navigate('/settings')}><Text>Open Settings</Text></Button>
          <Button variant="outline" className="h-11" onPress={() => router.push({ pathname: '/review', params: { manual: '1' } })}>
            <Icon as={PenLine} size={16} /><Text>Enter manually</Text>
          </Button>
        </View>
      </Screen>
    );
  }

  if (phase.kind === 'reading') {
    return (
      <Screen needsServer title={phase.mode === 'item' ? 'Identifying your item…' : 'Reading your receipt…'} description="This usually takes 5 to 15 seconds.">
        <View className={isPhone ? 'gap-4' : 'flex-row items-start gap-6'}>
          <Image source={{ uri: phase.photo.previewUri }} accessibilityLabel={phase.mode === 'item' ? 'Your item photo' : 'Your receipt'} resizeMode="contain" className="bg-muted aspect-[3/4] w-full max-w-xs self-center rounded-lg" />
          <Card className="flex-1 py-2">
            <CardContent className="gap-1 px-4" aria-live="polite">
              <Step done={phase.step === 'lookup'} active={phase.step === 'upload'} label={phase.mode === 'item' ? 'Identifying the food and any printed date' : 'Reading the text and the items'} />
              <Step done={false} active={phase.step === 'lookup'} label="Looking up shelf life for each item" />
            </CardContent>
          </Card>
        </View>
        <Button variant="outline" className="h-11 self-start" onPress={() => { run.current++; setPhase({ kind: 'idle' }); }}>
          <Text>Cancel</Text>
        </Button>
      </Screen>
    );
  }

  return (
    <Screen needsServer
      art="pumpkin"
      title="Stock your fridge"
      description="Photograph a receipt, or single items without one. Nothing goes in until you check it.">
      {phase.kind === 'error' && (
        <Alert icon={CircleAlert} variant="destructive">
          <AlertTitle>{phase.title}</AlertTitle>
          <AlertDescription>{phase.message}</AlertDescription>
          <View className="ml-6 mt-2 flex-row flex-wrap gap-2 pb-2">
            {phase.photo && <Button variant="outline" className="h-11" onPress={() => phase.photo && void scan(phase.photo, phase.mode)}><Text>Try again</Text></Button>}
            <Button variant="ghost" className="h-11" onPress={() => router.push({ pathname: '/review', params: { manual: '1' } })}><Text>Enter manually</Text></Button>
          </View>
        </Alert>
      )}
      {/* Receipt first: it's the main way in and brings prices. Single items are for food without one.
          flex-1 only side by side: in the phone's column it would force both cards to the same height. */}
      <View className={isPhone ? 'gap-4' : 'flex-row items-stretch gap-4'}>
        <Card className={isPhone ? undefined : 'flex-1'}>
          <CardContent className={cn('gap-3', !isPhone && 'flex-1')}>
            <Icon as={ReceiptText} size={32} className="text-primary" />
            <Text role="heading" aria-level={2} className="font-semibold">{isPhone ? 'Snap your receipt' : 'Upload a photo of your receipt'}</Text>
            {/* Side by side the text grows, so both cards' buttons line up along the bottom. */}
            <Text className={cn('text-muted-foreground text-sm', !isPhone && 'flex-1')}>
              Lay it flat in good light with the whole receipt in frame. We read the items and prices, and you check them before anything goes in.
              {settings.tesseractOnly ? ' AI reading is off, so names stay as printed.' : ''}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button className="h-11" onPress={() => void pick('camera')}>
                <Icon as={Camera} size={16} className="text-primary-foreground" />
                <Text>Take photo</Text>
              </Button>
              <Button variant="outline" className="h-11" onPress={() => void pick('library')}>
                <Icon as={Images} size={16} />
                <Text>{isPhone ? 'Gallery' : 'Choose image'}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
        <Card className={isPhone ? undefined : 'flex-1'}>
          <CardContent className={cn('gap-3', !isPhone && 'flex-1')}>
            <Icon as={ScanLine} size={32} className="text-primary" />
            <Text role="heading" aria-level={2} className="font-semibold">{isPhone ? 'Snap a single item' : 'Upload a photo of one item'}</Text>
            <Text className={cn('text-muted-foreground text-sm', !isPhone && 'flex-1')}>
              For food without a receipt: leftovers, gifts, market buys. One item per photo, close up. We name it and read any date printed on the pack. It has no price, so it stays out of your ledger unless you add one.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button variant="outline" className="h-11" onPress={() => void pick('camera', 'item')}>
                <Icon as={Camera} size={16} />
                <Text>Photo of item</Text>
              </Button>
              <Button variant="outline" className="h-11" onPress={() => void pick('library', 'item')}>
                <Icon as={Images} size={16} />
                <Text>{isPhone ? 'Gallery' : 'Choose image'}</Text>
              </Button>
            </View>
          </CardContent>
        </Card>
      </View>
      <Button variant="ghost" className="h-11 self-start" onPress={() => router.push({ pathname: '/review', params: { manual: '1' } })}>
        <Icon as={PenLine} size={16} />
        <Text>No photo? Enter items by hand</Text>
      </Button>

      <ConfirmDialog
        open={noticeFor !== null}
        onOpenChange={(o) => !o && setNoticeFor(null)}
        title={noticeFor?.mode === 'item' ? 'Send your item photo to Gemini?' : 'Before your first scan'}
        description={noticeFor?.mode === 'item'
          ? "The photo is sent to your Ghost Kitchen server, which passes it to Google Gemini to identify the food. Unlike receipts, the whole image goes to Google. It is not stored by us. On Gemini's free tier, Google may use submitted content to improve its products. Keep people and documents out of the frame."
          : "Your receipt photo is sent to your Ghost Kitchen server, which reads the text and asks Google Gemini to identify the items. Only the receipt text and product names go to Google, never your account details. On Gemini's free tier, Google may use submitted content to improve its products."}
        confirmLabel="Continue with Gemini"
        cancelLabel={noticeFor?.mode === 'item' ? 'Not now' : 'Basic reading only'}
        onCancel={() => {
          const n = noticeFor;
          setNoticeFor(null);
          if (!n || n.mode === 'item') return;
          updateSettings({ aiNoticeSeen: true, tesseractOnly: true });
          setTimeout(() => void pick(n.source, n.mode), 0);
        }}
        onConfirm={() => {
          const n = noticeFor;
          updateSettings(n?.mode === 'item' ? { itemPhotoNoticeSeen: true, aiNoticeSeen: true } : { aiNoticeSeen: true });
          setNoticeFor(null);
          if (n) setTimeout(() => void pick(n.source, n.mode), 0);
        }}
      />
    </Screen>
  );
}

function Step({ done, active, label }: { done: boolean; active: boolean; label: string }) {
  return (
    <View className="border-border min-h-12 flex-row items-center gap-3 border-b py-2 last:border-b-0">
      {active ? <Icon as={LoaderCircle} size={16} className="text-primary animate-spin" /> : <View className={done ? 'bg-stage-fresh h-2 w-2 rounded-full' : 'bg-muted h-2 w-2 rounded-full'} />}
      <Text className={active ? 'text-sm font-semibold' : done ? 'text-stage-fresh text-sm' : 'text-muted-foreground text-sm'}>{label}{active ? '…' : ''}</Text>
    </View>
  );
}

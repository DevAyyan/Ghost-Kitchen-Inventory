import { ResponsiveSheet } from '@/components/common/responsive-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { api, isApiConfigured } from '@/lib/api';
import { isCookable } from '@/lib/domain/expiry';
import { formatQty } from '@/lib/domain/units';
import { parseVoice, type VoiceAction } from '@/lib/domain/voice';
import { sfx } from '@/lib/feedback';
import { listen, speechAvailable, speechUnavailableReason } from '@/lib/speech';
import { useApp } from '@/lib/store/app-store';
import { useSettings } from '@/lib/store/settings-store';
import { toast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Trash2, Utensils } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

type Row = VoiceAction & { on: boolean };

/**
 * "Tell the fridge": say or type what you used or threw out, check what was understood, confirm.
 * The app's own parser reads the sentence; Gemini is asked only if that finds nothing. Nothing changes
 * until Confirm.
 */
export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = useApp((s) => s.items);
  const consumeItem = useApp((s) => s.consumeItem);
  const discardItem = useApp((s) => s.discardItem);
  const settings = useSettings((s) => s.settings);
  const [text, setText] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [unmatched, setUnmatched] = React.useState<string[]>([]);
  const [reading, setReading] = React.useState(false);
  // Shown in the sheet: toasts draw under the sheet, so they'd be hidden while it's open.
  const [problem, setProblem] = React.useState<string | null>(null);
  const stop = React.useRef<(() => void) | null>(null);
  const canSpeak = React.useMemo(() => speechAvailable(), []);

  React.useEffect(() => {
    if (open) return;
    stop.current?.();
    setText(''); setRows(null); setUnmatched([]); setListening(false); setProblem(null);
  }, [open]);

  const read = async (sentence: string) => {
    const s = sentence.trim();
    if (!s) return;
    const active = items.filter((i) => i.status === 'active');
    let { actions, unmatched: missed } = parseVoice(s, active);
    // Only when our own rules found nothing: a free-form sentence ("the greens were slimy") goes to Gemini.
    if (actions.length === 0 && !settings.tesseractOnly && !settings.demoMode && isApiConfigured() && active.length) {
      setReading(true);
      try {
        const res = await api.voiceParse({ text: s, items: active.slice(0, 150).map((i) => ({ id: i.id, name: i.name, unit: i.unit, left: i.qty * i.fraction })) });
        const byId = new Map(active.map((i) => [i.id, i]));
        actions = res.actions.flatMap((a) => {
          const it = byId.get(a.itemId);
          if (!it) return [];
          const left = it.qty * it.fraction;
          return [{ itemId: it.id, name: it.name, kind: a.kind, unit: it.unit, amount: a.kind === 'binned' || a.amount === null ? left : Math.min(left, a.amount), assumed: a.kind === 'used' && a.amount === null }];
        });
        if (actions.length) missed = [];
      } catch {
        // Offline or the server is busy: say what we couldn't match, and the user can rephrase.
      } finally {
        setReading(false);
      }
    }
    setRows(actions.map((a) => ({ ...a, on: true })));
    setUnmatched(missed);
  };

  const mic = async () => {
    if (listening) { stop.current?.(); return; }
    setRows(null);
    setProblem(null);
    setListening(true);
    stop.current = await listen({
      onText: (t, final) => { setText(t); if (final) void read(t); },
      onEnd: () => setListening(false),
      onError: (m) => setProblem(m),
    });
  };

  const confirm = () => {
    const chosen = (rows ?? []).filter((r) => r.on);
    let used = 0, buried = 0;
    for (const r of chosen) {
      if (r.kind === 'used') { if (consumeItem(r.itemId, r.amount)) used++; }
      else if (discardItem(r.itemId)) buried++;
    }
    if (buried) sfx('bury');
    toast([used ? `${used} used` : '', buried ? `${buried} buried` : ''].filter(Boolean).join(' · ') || 'Nothing changed');
    onClose();
  };

  const byId = new Map(items.map((i) => [i.id, i]));
  const chosen = rows?.filter((r) => r.on).length ?? 0;

  return (
    <ResponsiveSheet
      open={open}
      onClose={onClose}
      title="Tell the fridge"
      description='Say or type what happened, like "used half the milk and two eggs, threw out the spinach".'
      footer={rows && rows.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          <Button className="h-11 flex-1" disabled={chosen === 0} onPress={confirm}><Text>Confirm {chosen}</Text></Button>
          <Button variant="outline" className="h-11" onPress={() => setRows(null)}><Text>Try again</Text></Button>
        </View>
      ) : undefined}>
      <View className="gap-3">
        {canSpeak && (
          <Button
            variant={listening ? 'default' : 'outline'}
            className="h-14 self-start"
            onPress={() => void mic()}
            accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
            accessibilityState={{ busy: listening }}>
            <Icon as={listening ? MicOff : Mic} size={20} className={listening ? 'text-primary-foreground' : undefined} />
            <Text>{listening ? 'Listening… tap to stop' : 'Tap and speak'}</Text>
          </Button>
        )}
        <View className="flex-row flex-wrap gap-2">
          <Input
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => void read(text)}
            placeholder={canSpeak ? 'Or type it' : 'Type what you used or threw out'}
            accessibilityLabel="What you used or threw out"
            returnKeyType="done"
            maxLength={300}
            className="h-11 min-w-48 flex-1"
          />
          <Button variant="outline" className="h-11" disabled={!text.trim() || reading} onPress={() => void read(text)}><Text>{reading ? 'Reading…' : 'Read it'}</Text></Button>
        </View>
        {canSpeak
          ? <Text className="text-muted-foreground text-xs">Your phone's or browser's speech service turns your voice into text. The app keeps no recording.</Text>
          : <Text className="text-muted-foreground text-xs">{speechUnavailableReason()}</Text>}
        {problem && <Text role="alert" className="text-warning text-sm">{problem}</Text>}

        {rows && rows.length === 0 && (
          <Text role="alert" className="text-sm">Couldn't match that to anything in your fridge. Try naming the food as it's labelled.</Text>
        )}
        {rows && rows.length > 0 && (
          <View role="list" aria-label="What we understood" className="border-border border-2">
            {rows.map((r, n) => {
              const it = byId.get(r.itemId);
              const pastSafe = r.kind === 'used' && it && !isCookable(it);
              const toggle = () => setRows((rs) => rs!.map((x, k) => (k === n ? { ...x, on: !x.on } : x)));
              return (
                <Pressable key={r.itemId} role="listitem" onPress={toggle} accessibilityRole="checkbox" accessibilityState={{ checked: r.on }} aria-checked={r.on}
                  className={cn('border-border min-h-12 flex-row items-center gap-3 border-b px-3 py-2 last:border-b-0', !r.on && 'opacity-60')}>
                  <Checkbox checked={r.on} onCheckedChange={toggle} aria-hidden tabIndex={-1} focusable={false} importantForAccessibility="no-hide-descendants" />
                  <Icon as={r.kind === 'used' ? Utensils : Trash2} size={16} className={r.kind === 'used' ? 'text-stage-fresh' : 'text-destructive'} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm">{r.kind === 'used' ? `Used ${formatQty(r.amount, r.unit)} of ${r.name}` : `Bury ${r.name}`}</Text>
                    {r.assumed && <Text className="text-warning text-xs">No amount heard, so all of it. Untick if that's wrong.</Text>}
                    {pastSafe && <Text className="text-destructive text-xs">This is past its date. Check the food itself before eating it.</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {unmatched.length > 0 && rows && rows.length > 0 && (
          <Text className="text-muted-foreground text-xs">Not found in your fridge: {unmatched.join('; ')}.</Text>
        )}
      </View>
    </ResponsiveSheet>
  );
}

/** Opens the sheet; sits with the fridge screen's other actions. */
export function VoiceButton({ compact, onPress }: { compact: boolean; onPress: () => void }) {
  return (
    <Button variant="outline" className={compact ? 'h-11 w-11 px-0' : 'h-11'} accessibilityLabel="Tell the fridge what you used" onPress={onPress}>
      <Icon as={Mic} size={16} />
      {!compact && <Text>Tell the fridge</Text>}
    </Button>
  );
}


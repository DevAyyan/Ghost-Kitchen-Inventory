import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { ApiError, isApiConfigured } from '@/lib/api';
import { useHousehold } from '@/lib/store/household-store';
import { toast } from '@/lib/store/toast';
import { createHousehold, inviteCode, joinHousehold, leaveHousehold, syncNow } from '@/lib/sync';
import { RefreshCw, UserPlus, Users } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import { Section, StatusLine } from './parts';

/** Create, join, invite to and leave a shared household. */
export function HouseholdSection() {
  const household = useHousehold((st) => st.household);
  const syncing = useHousehold((st) => st.syncing);
  const lastSyncAt = useHousehold((st) => st.lastSyncAt);
  const lastError = useHousehold((st) => st.lastError);
  const pending = useHousehold((st) => Object.keys(st.pending).length);
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [invite, setInvite] = React.useState<{ code: string; expiresAt: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = React.useState(false);
  const configured = isApiConfigured();

  const run = async (what: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await what(); toast(ok); } catch (e) { toast(e instanceof ApiError ? e.message : 'That didn\'t work. Try again.'); } finally { setBusy(false); }
  };

  if (!household) {
    return (
      <Section title="Household">
        <Text className="text-muted-foreground mb-3 text-sm">
          Share one fridge, meal plan and shopping list with the people you live with. Changes sync through your Ghost Kitchen server. Photos stay on the phone that took them.
        </Text>
        {!configured ? (
          <Text className="text-muted-foreground text-sm">Set your server address above first.</Text>
        ) : (
          <View className="gap-4">
            <View className="gap-1.5">
              <Label nativeID="hh-name">Start a household</Label>
              <View className="flex-row flex-wrap gap-2">
                <Input aria-labelledby="hh-name" value={name} onChangeText={setName} placeholder="e.g. Flat 4B" maxLength={40} className="h-11 min-w-40 flex-1" />
                <Button variant="outline" className="h-11" disabled={busy || !name.trim()} onPress={() => void run(() => createHousehold(name), `${name.trim()} created. Invite the others from here.`)}>
                  <Icon as={Users} size={16} /><Text>Create</Text>
                </Button>
              </View>
            </View>
            <View className="gap-1.5">
              <Label nativeID="hh-code">Or join with an invite code</Label>
              <View className="flex-row flex-wrap gap-2">
                <Input aria-labelledby="hh-code" value={code} onChangeText={setCode} placeholder="8 letters and numbers" autoCapitalize="characters" autoCorrect={false} maxLength={12} className="h-11 min-w-40 flex-1" />
                <Button variant="outline" className="h-11" disabled={busy || code.replace(/[\s-]/g, '').length !== 8} onPress={() => void run(() => joinHousehold(code), 'Joined. Your food is now shared.')}>
                  <Text>Join</Text>
                </Button>
              </View>
              <Text className="text-muted-foreground text-xs">What's already on this device is added to the household.</Text>
            </View>
          </View>
        )}
      </Section>
    );
  }

  const when = lastSyncAt ? new Date(lastSyncAt) : null;
  return (
    <Section title="Household">
      <View className="gap-3">
        <View className="gap-1.5" aria-live="polite">
          <StatusLine state="ok" text={`${household.name} · ${household.members} device${household.members === 1 ? '' : 's'}`} />
          {syncing ? (
            <StatusLine state="pending" text="Syncing…" />
          ) : lastError ? (
            <StatusLine state="warn" text={`${lastError}${pending ? ` ${pending} change${pending === 1 ? '' : 's'} waiting.` : ''}`} />
          ) : (
            <StatusLine state="ok" text={when ? `Up to date · last synced ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not synced yet'} />
          )}
        </View>
        {invite && (
          <View className="border-primary/60 gap-1 rounded-lg border p-3">
            <Text className="text-muted-foreground text-xs">Invite code (works once, for 10 minutes)</Text>
            <Text selectable className="text-2xl font-bold tracking-widest tabular-nums" accessibilityLabel={`Invite code ${invite.code.split('').join(' ')}`}>{invite.code}</Text>
            <Text className="text-muted-foreground text-xs">On the other phone: Settings → Household → Join. Anyone with this code can see and change your food, so only share it with your household.</Text>
          </View>
        )}
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" className="h-11" disabled={busy} onPress={() => void run(async () => setInvite(await inviteCode()), 'Invite code ready')}>
            <Icon as={UserPlus} size={16} /><Text>Invite someone</Text>
          </Button>
          <Button variant="ghost" className="h-11" disabled={syncing} onPress={() => void syncNow()}>
            <Icon as={RefreshCw} size={16} /><Text>Sync now</Text>
          </Button>
          <Button variant="ghost" className="h-11" onPress={() => setConfirmLeave(true)}>
            <Text>Leave household</Text>
          </Button>
        </View>
        <Text className="text-muted-foreground text-xs">Photos stay on the phone that took them. Settings like currency and diet are per device.</Text>
      </View>
      <ConfirmDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title={`Leave ${household.name}?`}
        description="This device stops sharing. It keeps a copy of everything as it is now; the others keep theirs. To join again you'll need a new invite."
        confirmLabel="Leave"
        destructive
        onConfirm={() => void leaveHousehold().then((told) => { setInvite(null); toast(told ? 'You left the household' : "You left on this device. The server couldn't be reached, so it may still list this device."); })}
      />
    </Section>
  );
}


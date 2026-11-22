import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Screen } from '@/components/common/screen';
import { BadgeGrid } from '@/components/profile/badge-grid';
import { GhostAvatar } from '@/components/profile/ghost-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { onSignedOut, saveProfile } from '@/lib/account';
import { api, ApiError, type HouseholdMember } from '@/lib/api';
import { today } from '@/lib/domain/dates';
import { AVATAR_COLOURS, AVATAR_HEX, badges, myEvents, personalStats, type Avatar } from '@/lib/domain/profile';
import { useSummarize } from '@/lib/rates';
import { useApp } from '@/lib/store/app-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useHousehold } from '@/lib/store/household-store';
import { useServer } from '@/lib/store/server-store';
import { toast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';
import { useClerk } from '@clerk/expo';
import { GHOSTS } from '@/components/fridge/ghost-sprites';
import { pixelated } from '@/components/fridge/pixel-effects';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, LogOut, Trash2 } from 'lucide-react-native';
import * as React from 'react';
import { Image, Pressable, View } from 'react-native';

/** The profile needs Clerk, which only runs when the server asks for sign-in. */
export default function ProfileRoute() {
  const clerk = useServer((s) => s.auth?.provider === 'clerk');
  const me = useAuthStore((s) => s.me);
  const router = useRouter();
  if (!clerk || !me) {
    return (
      <Screen title="Profile">
        <Text className="text-muted-foreground">This server doesn't use accounts, so there's no profile to show.</Text>
        <Button variant="outline" className="h-11 self-start" onPress={() => router.back()}><Text>Back</Text></Button>
      </Screen>
    );
  }
  return <ProfileScreen />;
}

function ProfileScreen() {
  const me = useAuthStore((s) => s.me)!;
  const router = useRouter();
  const clerk = useClerk();
  const household = useHousehold((s) => s.household);
  const events = useApp((s) => s.events);
  const summarize = useSummarize();
  const [name, setName] = React.useState(me.displayName);
  const [saving, setSaving] = React.useState(false);
  const [confirm, setConfirm] = React.useState<'signout' | 'delete' | null>(null);

  const stats = React.useMemo(() => personalStats(myEvents(events, me.id, !!household), today()), [events, me.id, household]);
  const list = badges(stats);
  const earned = list.filter((b) => b.earned).length;

  const save = async (patch: { displayName?: string; avatar?: Avatar }) => {
    setSaving(true);
    const err = await saveProfile(patch);
    setSaving(false);
    toast(err ?? 'Profile saved');
  };

  const signOut = async () => {
    try { await clerk.signOut(); } catch { /* offline: forget the person here anyway */ }
    onSignedOut();
  };

  const deleteAccount = async () => {
    try {
      await api.deleteMe();
      await clerk.user?.delete();
      await clerk.signOut().catch(() => {});
      onSignedOut();
      toast('Your account is deleted. The food on this device is still here.');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't delete your account. Check your connection and try again.");
    }
  };

  return (
    <Screen title="Your profile" description={me.email}>
      <Button variant="ghost" className="-ml-3 h-11 self-start" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}>
        <Icon as={ArrowLeft} size={16} />
        <Text>Back</Text>
      </Button>

      <Card className="gap-3 py-4">
        <CardHeader className="flex-row items-center gap-3 px-4">
          <GhostAvatar avatar={me.avatar} size={56} />
          <View className="flex-1">
            <CardTitle role="heading" aria-level={2} className="text-xl">{me.displayName}</CardTitle>
            <Text className="text-muted-foreground text-sm">{household ? `${household.name} · ${household.members} in the household` : 'Not sharing a kitchen'}</Text>
          </View>
        </CardHeader>
        <CardContent className="gap-3 px-4">
          <View className="flex-row items-center gap-2">
            <Input value={name} onChangeText={setName} maxLength={40} accessibilityLabel="Your name" placeholder="Your name" className="h-11 flex-1" />
            <Button className="h-11" disabled={saving || !name.trim() || name.trim() === me.displayName} onPress={() => save({ displayName: name.trim() })}>
              <Text>Save</Text>
            </Button>
          </View>
          <Text className="text-muted-foreground text-xs">Your housemates see this name and ghost next to what you add and use.</Text>

          <Text className="text-sm font-semibold">Your ghost</Text>
          <View role="radiogroup" aria-label="Your ghost" className="flex-row flex-wrap gap-2">
            {GHOSTS.map((src, i) => (
              <Pressable
                key={i}
                role="radio"
                aria-checked={me.avatar.ghost === i}
                accessibilityLabel={`Ghost ${i + 1}`}
                onPress={() => save({ avatar: { ...me.avatar, ghost: i } })}
                className={cn('h-14 w-14 items-center justify-center border-2', me.avatar.ghost === i ? 'border-primary bg-primary/10' : 'border-border')}>
                <Image source={src} fadeDuration={0} style={[{ width: 40, height: 40, resizeMode: 'stretch' }, pixelated]} />
              </Pressable>
            ))}
          </View>
          <Text className="text-sm font-semibold">Its colour</Text>
          <View role="radiogroup" aria-label="Ghost colour" className="flex-row flex-wrap gap-2">
            {AVATAR_COLOURS.map((c) => (
              <Pressable
                key={c}
                role="radio"
                aria-checked={me.avatar.colour === c}
                accessibilityLabel={c}
                onPress={() => save({ avatar: { ...me.avatar, colour: c } })}
                className={cn('h-11 w-11 items-center justify-center border-2', me.avatar.colour === c ? 'border-foreground' : 'border-black/40')}
                style={{ backgroundColor: AVATAR_HEX[c] }}>
                {me.avatar.colour === c && <Icon as={Check} size={16} className="text-white" />}
              </Pressable>
            ))}
          </View>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Your record</CardTitle></CardHeader>
        <CardContent className="gap-3 px-4">
          <View className="flex-row flex-wrap gap-3">
            <Stat label="Ghosts banished" value={String(stats.banished)} note="food used while it was turning" />
            <Stat label="Saved" value={stats.saved.length ? summarize(stats.saved).text : 'Nothing yet'} note="value of that food" />
            <Stat label="Buried" value={stats.lost.length ? summarize(stats.lost).text : 'Nothing'} note={`${stats.buried} item${stats.buried === 1 ? '' : 's'} thrown out`} />
            <Stat label="Quiet weeks" value={String(stats.streak)} note="in a row, nothing thrown out" />
          </View>
          {household && <Text className="text-muted-foreground text-xs">Counts what you did. The household's totals are on the Ledger.</Text>}
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Badges · {earned} of {list.length}</CardTitle></CardHeader>
        <CardContent className="px-4">
          <BadgeGrid list={list} />
        </CardContent>
      </Card>

      {household && <Members householdKey={household.key} />}

      <Card className="gap-3 py-4">
        <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Account</CardTitle></CardHeader>
        <CardContent className="gap-2 px-4">
          <View className="flex-row flex-wrap gap-2">
            <Button variant="outline" className="h-11" onPress={() => setConfirm('signout')}>
              <Icon as={LogOut} size={16} />
              <Text>Sign out</Text>
            </Button>
            <Button variant="destructive" className="h-11" onPress={() => setConfirm('delete')}>
              <Icon as={Trash2} size={16} className="text-white" />
              <Text className="text-white">Delete account</Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm === 'signout'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Sign out?"
        description="The food on this device stays here. You'll need to sign in to open the app again."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={() => { setConfirm(null); void signOut(); }}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete your account?"
        description={household
          ? `Your profile and badges go, and you leave ${household.name}. The household's food stays for the others, and on this device.`
          : 'Your profile and badges go. The food on this device stays here.'}
        confirmLabel="Delete account"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => { setConfirm(null); void deleteAccount(); }}
      />
    </Screen>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View role="group" accessibilityLabel={`${label}: ${value}, ${note}`} className="border-border bg-background min-w-36 flex-1 gap-0.5 border-2 p-3">
      <Text className="text-muted-foreground text-xs">{label}</Text>
      <Text className="text-lg font-bold tabular-nums">{value}</Text>
      <Text className="text-muted-foreground text-xs">{note}</Text>
    </View>
  );
}

/** Who shares the kitchen. The owner can remove people; everyone sees names and ghosts. */
function Members({ householdKey }: { householdKey: string }) {
  const [people, setPeople] = React.useState<HouseholdMember[] | null>(null);
  const [devices, setDevices] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [removing, setRemoving] = React.useState<HouseholdMember | null>(null);
  const load = React.useCallback(async () => {
    try {
      const res = await api.householdMembers(householdKey);
      setPeople(res.people);
      setDevices(res.devices);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [householdKey]);
  React.useEffect(() => { void load(); }, [load]);
  const owner = people?.find((p) => p.you)?.role === 'owner';

  const remove = async (p: HouseholdMember) => {
    try {
      await api.removeMember(householdKey, p.userId);
      toast(`${p.displayName} no longer shares this kitchen`);
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't remove them. Try again.");
    }
  };

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4"><CardTitle role="heading" aria-level={2}>Who shares this kitchen</CardTitle></CardHeader>
      <CardContent className="gap-2 px-4">
        {failed && <Text className="text-muted-foreground text-sm">Can't load the household right now. It works offline; this needs the server.</Text>}
        {!people && !failed && <Text className="text-muted-foreground text-sm">Loading…</Text>}
        <View role="list" className="gap-2">
          {people?.map((p) => (
            <View key={p.userId} role="listitem" className="flex-row items-center gap-3">
              <GhostAvatar avatar={p.avatar} size={36} />
              <View className="flex-1">
                <Text className="font-semibold">{p.displayName}{p.you ? ' (you)' : ''}</Text>
                <Text className="text-muted-foreground text-xs">{p.role === 'owner' ? 'Owner' : 'Member'}</Text>
              </View>
              {owner && !p.you && (
                <Button variant="outline" className="h-11" onPress={() => setRemoving(p)} accessibilityLabel={`Remove ${p.displayName} from the household`}>
                  <Text>Remove</Text>
                </Button>
              )}
            </View>
          ))}
        </View>
        {devices > 0 && (
          <Text className="text-muted-foreground text-xs">
            {devices === 1 ? '1 device still shares' : `${devices} devices still share`} without an account. They link when someone signs in on them.
          </Text>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.displayName ?? ''}?`}
        description="They stop seeing this kitchen's food. What's already on their phone stays there."
        confirmLabel="Remove"
        cancelLabel="Keep them"
        destructive
        onConfirm={() => { const p = removing; setRemoving(null); if (p) void remove(p); }}
      />
    </Card>
  );
}

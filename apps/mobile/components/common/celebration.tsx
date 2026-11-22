import { GHOSTS } from '@/components/fridge/ghost-sprites';
import { onTick, pixelated } from '@/components/fridge/pixel-effects';
import { Art } from '@/components/halloween/art';
import { Text } from '@/components/ui/text';
import { today } from '@/lib/domain/dates';
import { badges, myEvents, personalStats, type Badge } from '@/lib/domain/profile';
import type { ItemEvent } from '@/lib/domain/types';
import { useMotionAllowed } from '@/lib/hooks';
import { useApp } from '@/lib/store/app-store';
import { useAuthStore } from '@/lib/store/auth-store';
import { useHousehold } from '@/lib/store/household-store';
import { toast } from '@/lib/store/toast';
import { useDay } from '@/lib/store/clock';
import { stageOf } from '@/lib/domain/expiry';
import { sfx } from '@/lib/feedback';
import * as React from 'react';
import { Image, View } from 'react-native';

type Moment = { kind: 'banish'; key: number } | { kind: 'badge'; badge: Badge; key: number } | { kind: 'spoil'; names: string[]; key: number };

/** Frames of the ghost leaving, a step each: rising a few pixels and thinning out, the way sprites fade. */
const BANISH_STEPS = [
  { y: 0, o: 1 }, { y: -6, o: 1 }, { y: -12, o: 0.75 }, { y: -18, o: 0.75 }, { y: -24, o: 0.5 }, { y: -30, o: 0.25 },
];
const STEP_MS = 120;
const BADGE_MS = 2200;

const earnedIds = (events: ItemEvent[], me: string | null, sharing: boolean) =>
  new Set(badges(personalStats(myEvents(events, me, sharing), today())).filter((b) => b.earned).map((b) => b.id));

/**
 * A small reward for the habit the app is about. Using food that was turning lets its ghost go; earning a
 * badge shows it for a moment. Only for this person's own action (one new history entry, theirs), never for
 * a housemate's synced change or sample data. Decorative: the toast says the same, and reduced motion skips it.
 */
export function Celebration() {
  const motion = useMotionAllowed();
  const [moment, setMoment] = React.useState<Moment | null>(null);

  React.useEffect(() => {
    let key = 0;
    return useApp.subscribe((next, prev) => {
      if (next.events === prev.events || next.events.length !== prev.events.length + 1) return;
      const e = next.events[0];
      const me = useAuthStore.getState().me?.id ?? null;
      if (!e || (e.by ?? null) !== me) return;
      const sharing = !!useHousehold.getState().household;
      const before = earnedIds(prev.events, me, sharing);
      const fresh = badges(personalStats(myEvents(next.events, me, sharing), today())).find((b) => b.earned && !before.has(b.id));
      if (fresh) {
        // After the "used it" or "buried" message the action itself shows, so neither hides the other.
        setTimeout(() => toast(`Badge earned: ${fresh.title}. See it on the ledger.`), 3400);
        setMoment({ kind: 'badge', badge: fresh, key: ++key });
      } else if (e.type === 'used' && e.stage !== 'fresh') {
        sfx('rescue');
        setMoment({ kind: 'banish', key: ++key });
      }
    });
  }, []);

  // Food that spoils while the app is open (the date turns over): a groan and a shake, once per item.
  // Not on launch, so opening the app never greets you with a fright.
  const day = useDay((s) => s.day);
  const spoiledSeen = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    const now = useApp.getState().items.filter((i) => i.status === 'active' && stageOf(i, day) === 'spoiled');
    const seen = spoiledSeen.current;
    spoiledSeen.current = new Set(now.map((i) => i.id));
    if (!seen) return;
    const fresh = now.filter((i) => !seen.has(i.id));
    if (fresh.length === 0) return;
    sfx('spoil');
    toast(`${fresh.map((i) => i.name).slice(0, 3).join(', ')}${fresh.length > 3 ? ` and ${fresh.length - 3} more` : ''} spoiled. Bury ${fresh.length === 1 ? 'it' : 'them'} from the fridge.`);
    setMoment({ kind: 'spoil', names: fresh.map((i) => i.name), key: Date.now() });
  }, [day]);

  const done = React.useCallback(() => setMoment(null), []);
  if (!moment || !motion) return null;
  if (moment.kind === 'spoil') return <SpoilShake key={moment.key} onDone={done} />;
  return moment.kind === 'banish'
    ? <Banish key={moment.key} onDone={done} />
    : <BadgeMoment key={moment.key} badge={moment.badge} onDone={done} />;
}

function Banish({ onDone }: { onDone: () => void }) {
  const [step, setStep] = React.useState(0);
  const [ghost] = React.useState(() => GHOSTS[Math.floor(Math.random() * GHOSTS.length)]);
  React.useEffect(() => {
    const start = Date.now();
    const off = onTick((now) => {
      const s = Math.floor((now - start) / STEP_MS);
      if (s >= BANISH_STEPS.length) { off(); onDone(); return; }
      setStep(s);
    });
    return off;
  }, [onDone]);
  const f = BANISH_STEPS[step]!;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="absolute inset-0 items-center justify-center">
      <View style={{ opacity: f.o, transform: [{ translateY: f.y * 2 }] }} className="items-center gap-1">
        <Image source={ghost} fadeDuration={0} style={[{ width: 96, height: 96, resizeMode: 'stretch' }, pixelated]} />
        <View className="bg-background/90 border-primary border-2 px-3 py-1"><Text className="font-display text-primary text-xl">Ghost banished!</Text></View>
      </View>
    </View>
  );
}

function BadgeMoment({ badge, onDone }: { badge: Badge; onDone: () => void }) {
  const [big, setBig] = React.useState(false);
  React.useEffect(() => {
    const pop = setTimeout(() => setBig(true), 90);
    const end = setTimeout(onDone, BADGE_MS);
    return () => { clearTimeout(pop); clearTimeout(end); };
  }, [onDone]);
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="absolute inset-0 items-center justify-center">
      {/* Two steps, small then full size: a pixel "pop" rather than a smooth zoom. */}
      <View className="bg-popover border-primary items-center gap-2 border-2 border-b-4 px-6 py-4" style={{ transform: [{ scale: big ? 1 : 0.75 }] }}>
        <Art name={badge.art} size={64} />
        <Text className="font-display text-primary text-xl">Badge earned</Text>
        <Text className="font-semibold">{badge.title}</Text>
      </View>
    </View>
  );
}

/** Offsets of a slow, stepped shake: a heavy thud that dies out. */
const SHAKE = [0, -6, 6, -5, 5, -3, 3, -1, 0];

function SpoilShake({ onDone }: { onDone: () => void }) {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const off = onTick((now) => {
      const s = Math.floor((now - start) / 90);
      if (s >= SHAKE.length + 6) { off(); onDone(); return; }
      setStep(s);
    });
    return off;
  }, [onDone]);
  const x = SHAKE[Math.min(step, SHAKE.length - 1)]!;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" pointerEvents="none" className="bg-destructive/10 absolute inset-0 items-center justify-center">
      <View style={{ transform: [{ translateX: x * 2 }] }} className="items-center gap-1">
        <Art name="headstone" size={80} />
        <View className="bg-background/90 border-destructive border-2 px-3 py-1"><Text className="font-display text-destructive text-xl">Something spoiled</Text></View>
      </View>
    </View>
  );
}

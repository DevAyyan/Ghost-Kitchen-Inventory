import { STAGE_META } from '@/lib/domain/catalog';
import type { Stage } from '@/lib/domain/types';
import { Bug, Flame, Ghost, Hourglass, Sprout, type LucideIcon } from 'lucide-react-native';

/**
 * Stage presentation. Class names are spelled out literally so Tailwind/NativeWind can find them.
 * Every stage has icon + label + colour, plus a distinct border style for rotting/spoiled.
 */
export const STAGE_STYLE: Record<
  Stage,
  { icon: LucideIcon; label: string; text: string; border: string; bg: string; tint: string }
> = {
  fresh: { icon: Sprout, label: STAGE_META.fresh.label, text: 'text-stage-fresh', border: 'border-stage-fresh', bg: 'bg-stage-fresh', tint: 'bg-stage-fresh/10' },
  aging: { icon: Hourglass, label: STAGE_META.aging.label, text: 'text-stage-aging', border: 'border-stage-aging', bg: 'bg-stage-aging', tint: 'bg-stage-aging/10' },
  expiring: { icon: Flame, label: STAGE_META.expiring.label, text: 'text-stage-expiring', border: 'border-stage-expiring', bg: 'bg-stage-expiring', tint: 'bg-stage-expiring/15' },
  rotting: { icon: Bug, label: STAGE_META.rotting.label, text: 'text-stage-rotting', border: 'border-stage-rotting border-dashed', bg: 'bg-stage-rotting', tint: 'bg-stage-rotting/15' },
  spoiled: { icon: Ghost, label: STAGE_META.spoiled.label, text: 'text-stage-spoiled', border: 'border-stage-spoiled border-dotted', bg: 'bg-stage-spoiled', tint: 'bg-stage-spoiled/10' },
};

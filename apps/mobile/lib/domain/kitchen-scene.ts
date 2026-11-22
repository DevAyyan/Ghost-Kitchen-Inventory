import { ZONES } from './catalog';
import { isHaunting, stageOf } from './expiry';
import { doorSignals, doorSummary } from './haunt';
import type { IsoDate, Item, Zone } from './types';

/** The sprite sheets are 78 x 79 px frames; the scene puts the fridge-freezer and the pantry side by side. */
export const SPRITE_W = 78;
export const SPRITE_H = 79;
export const SCENE_ASPECT = (SPRITE_W * 2) / SPRITE_H;

/** Every set: shut (0), ajar (1), then four frames out to fully open. */
export const FRAME_COUNT = 6;
/** The frame an ajar door rests on. */
export const AJAR_FRAME = 1;

/**
 * The part of the scene each door fills when zoomed in, in sprite pixels from the scene's top-left: the
 * appliance body plus the door swinging out beside it. The freezer is the top 30 rows, the fridge the rest.
 */
export const REGION: Record<Zone, { x: number; y: number; w: number; h: number }> = {
  freezer: { x: 0, y: 0, w: SPRITE_W, h: 30 },
  fridge: { x: 0, y: 30, w: SPRITE_W, h: 49 },
  pantry: { x: SPRITE_W, y: 0, w: SPRITE_W, h: SPRITE_H },
};

/** Share of the window the zoomed region may fill, so the edge of the sprite doesn't touch the screen edge. */
const FILL = 0.96;

/**
 * Where to point the camera so a zone covers (almost all of) the window. The scene box (`boxW` x `boxH` px)
 * is scaled about its centre by `s = 1 + (scale - 1) * t`, with t running 0 (as laid out) to 1 (zoomed in).
 * `fx`, `fy` are the region centre's offset from the box centre. See ZoomOverlay for how they're applied.
 */
export function zoomTarget(zone: Zone, boxW: number, boxH: number, winW: number, winH: number) {
  const r = REGION[zone];
  const u = boxW / (SPRITE_W * 2);
  return {
    scale: FILL * Math.min(winW / (r.w * u), winH / (r.h * u)),
    fx: ((r.x + r.w / 2) / (SPRITE_W * 2)) * boxW - boxW / 2,
    fy: ((r.y + r.h / 2) / SPRITE_H) * boxH - boxH / 2,
  };
}

/** First sprite row of the fridge door; the freezer is the rows above it. */
export const SEAM_ROW = 30;

/**
 * Where a ghost peeks from an ajar door, in sprite pixels within that zone's 78 x 79 frame. The window's right
 * edge is the door edge at the crack (AJAR in scripts/spookify-sprites.py); the ghost is clipped to it and
 * slides out leftward from behind the door, over the crack and the frame (or the left pantry leaf).
 */
export const GAPS: Record<Zone, { x: number; y: number; w: number; h: number }> = {
  freezer: { x: 0, y: 3, w: 9, h: 26 },
  fridge: { x: 0, y: 32, w: 9, h: 41 },
  pantry: { x: 6, y: 2, w: 17, h: 72 },
};

/** The ghost sprites are 24 px cells, drawn at one art pixel per sprite pixel. */
export const GHOST_PX = 24;

export interface SceneZone {
  /** Shown on the scene: what's on the shelves (after any search or filter). */
  count: number;
  /** Everything stored here that is expiring, rotting or spoiled, filter or not. Sets the door ajar. */
  haunting: number;
  /** Spoken label for the door, e.g. "Fridge door, closed. 12 items: … Open it." */
  label: string;
}

/** Which doors stand ajar: something behind them is expiring, rotting or spoiled ("haunting"). */
export type Ajar = Record<Zone, boolean>;

/** What each zone's door says on the scene, from the shown (filtered) items and everything stored. */
export function sceneZones(items: Item[], allItems: Item[], now?: IsoDate): Record<Zone, SceneZone> {
  return Object.fromEntries(
    (['freezer', 'fridge', 'pantry'] as const).map((z) => {
      const stored = allItems.filter((i) => i.zone === z);
      return [z, {
        count: items.filter((i) => i.zone === z).length,
        haunting: stored.filter((i) => isHaunting(stageOf(i, now))).length,
        label: `${ZONES[z].label} door, closed. ${doorSummary(doorSignals(stored, now))}. Open it.`,
      }];
    }),
  ) as Record<Zone, SceneZone>;
}

export const ajarOf = (zones: Record<Zone, SceneZone>): Ajar => ({
  freezer: zones.freezer.haunting > 0, fridge: zones.fridge.haunting > 0, pantry: zones.pantry.haunting > 0,
});

/** The frame a door rests on: ajar with food turning behind it, shut otherwise. */
export const restFrame = (zone: Zone, ajar: Ajar) => (ajar[zone] ? AJAR_FRAME : 0);

/**
 * Sections whose food changed between two versions of the item list: an item added, finished, moved or
 * edited. Used to show a housemate's change on the shared kitchen.
 */
export function changedZones(before: Item[], after: Item[]): Zone[] {
  const out = new Set<Zone>();
  const old = new Map(before.map((i) => [i.id, i]));
  const now = new Map(after.map((i) => [i.id, i]));
  for (const [id, i] of now) {
    const was = old.get(id);
    if (!was) { if (i.status === 'active') out.add(i.zone); continue; }
    if (was.zone !== i.zone) { out.add(was.zone); out.add(i.zone); continue; }
    if (was.status !== i.status || was.expires !== i.expires || was.name !== i.name || was.qty !== i.qty) out.add(i.zone);
  }
  for (const [id, i] of old) if (!now.has(id) && i.status === 'active') out.add(i.zone);
  return (['freezer', 'fridge', 'pantry'] as const).filter((z) => out.has(z));
}

/**
 * How dark the kitchen is at a local hour: 0 by day, a half step at dusk and dawn, full at night. Stepped,
 * not smooth, like the pixel art. The night is when ghosts are out, so the scene leans into it.
 */
export function nightLevel(hour: number): 0 | 0.5 | 1 {
  if (hour >= 22 || hour < 5) return 1;
  if (hour >= 19 || hour < 7) return 0.5;
  return 0;
}

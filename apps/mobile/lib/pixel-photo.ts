import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Pixel-art versions of the user's food photos, for shelf tiles. Made on demand and kept in memory only:
 * the stored photo stays full size for the item sheet, and nothing new is persisted.
 *
 * Web: drawn into a CANVAS cells wide, then scaled back up with smoothing off, so the blocks are crisp.
 * Android: React Native has no nearest-neighbour scaling, so the photo is shrunk to CELLS and shown as
 * is; it reads as a soft mosaic rather than hard pixels.
 */
export const PIXEL_CELLS = 16;
const UPSCALE = 4;

const cache = new Map<string, Promise<string | null>>();

export function pixelPhoto(uri: string): Promise<string | null> {
  let hit = cache.get(uri);
  if (!hit) {
    hit = (Platform.OS === 'web' ? onWeb(uri) : onNative(uri)).catch(() => null);
    cache.set(uri, hit);
    // Keep the cache small: a fridge has tens of items, not thousands.
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
  }
  return hit;
}

async function onNative(uri: string) {
  const r = await ImageManipulator.manipulate(uri).resize({ width: PIXEL_CELLS, height: PIXEL_CELLS }).renderAsync();
  const saved = await r.saveAsync({ format: SaveFormat.PNG });
  return saved.uri;
}

function onWeb(uri: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new (globalThis as unknown as { Image: new () => HTMLImageElement }).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const small = document.createElement('canvas');
      small.width = small.height = PIXEL_CELLS;
      const s = small.getContext('2d');
      if (!s) return resolve(null);
      // Centre-crop to a square, like the tile does.
      const side = Math.min(img.width, img.height);
      s.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, PIXEL_CELLS, PIXEL_CELLS);
      const big = document.createElement('canvas');
      big.width = big.height = PIXEL_CELLS * UPSCALE;
      const b = big.getContext('2d');
      if (!b) return resolve(null);
      b.imageSmoothingEnabled = false;
      b.drawImage(small, 0, 0, big.width, big.height);
      resolve(big.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = uri;
  });
}

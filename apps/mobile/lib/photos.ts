import { Directory, File as FsFile, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** Food photos are stored small: they are shelf thumbnails, not archives. */
const SIZE = 480;
const QUALITY = 0.6;

export type PhotoSource = 'camera' | 'library';
export type PhotoResult = { uri: string } | { error: string } | null;

/**
 * Lets the user take (or pick) a photo of a food item, downscaled (and square-cropped on Android).
 * - Android/iOS: saved to the app's document directory so the OS cache cleanup can't remove it.
 * - Web: returned as a small JPEG data URI so it survives reloads in local storage.
 * Returns null when the user cancels.
 */
export async function captureFoodPhoto(source: PhotoSource): Promise<PhotoResult> {
  if (Platform.OS === 'web') return captureOnWeb(source);
  try {
    let src = source;
    if (src === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) src = 'library'; // fall back to the system photo picker (no permission needed)
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true, // Android shows a crop step
      aspect: [1, 1],
      quality: 0.8,
      exif: false,
    };
    const res = src === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return null;

    const rendered = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: SIZE }).renderAsync();
    const saved = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

    const dir = new Directory(Paths.document, 'food-photos');
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new FsFile(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`);
    await new FsFile(saved.uri).copy(dest);
    return { uri: dest.uri };
  } catch {
    return { error: 'Could not take that photo. Try again or pick one from your gallery.' };
  }
}

/** Web: pick (or, on phones, shoot) an image and return a small JPEG data URI. */
async function captureOnWeb(source: PhotoSource): Promise<PhotoResult> {
  const file = await pickWebFile(source === 'camera');
  if (!file) return null;
  if (!file.type.startsWith('image/')) return { error: 'That file is not an image. Try a JPG or PNG.' };
  if (file.size > 15 * 1024 * 1024) return { error: 'That photo is too large. Try a smaller one.' };
  const url = URL.createObjectURL(file);
  try {
    const rendered = await ImageManipulator.manipulate(url).resize({ width: SIZE }).renderAsync();
    const saved = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: true });
    return saved.base64 ? { uri: `data:image/jpeg;base64,${saved.base64}` } : { error: 'Could not read that photo.' };
  } catch {
    return { error: 'Could not read that photo. Try a JPG or PNG.' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Hidden <input type="file"> that settles exactly once. Some browsers fire `cancel` and then a
 * late `change` (or `change` twice); a short grace after `cancel` lets a late selection still win.
 */
function pickWebFile(capture: boolean): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.setAttribute('capture', 'environment');
    input.setAttribute('data-testid', 'food-photo-input');
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const settle = (file: File | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(graceTimer);
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => settle(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => {
      graceTimer = setTimeout(() => settle(input.files?.[0] ?? null), 1500);
    });
    input.click();
  });
}

/** Receipts are uploaded at higher resolution than food photos: OCR needs to read small print. */
const RECEIPT_WIDTH = 1600;
const RECEIPT_QUALITY = 0.85;

export type ReceiptPhoto = { upload: { uri: string } | Blob; previewUri: string };

/**
 * Takes or picks a receipt photo, downscaled to RECEIPT_WIDTH (big phone photos upload slowly and don't
 * read better). Not cropped. Not stored: it's only sent to the server, then discarded.
 */
export async function captureReceipt(source: PhotoSource): Promise<ReceiptPhoto | { error: string } | null> {
  try {
    let input: string;
    let revoke: (() => void) | undefined;
    let heic = false;
    if (Platform.OS === 'web') {
      const file = await pickWebFile(source === 'camera');
      if (!file) return null;
      heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      if (!file.type.startsWith('image/')) return { error: 'That file is not an image. Try a JPG or PNG.' };
      input = URL.createObjectURL(file);
      revoke = () => URL.revokeObjectURL(input);
    } else {
      let src = source;
      if (src === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) src = 'library';
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, exif: false };
      const res = src === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return null;
      input = res.assets[0].uri;
    }
    try {
      const ctx = ImageManipulator.manipulate(input);
      const rendered = await ctx.renderAsync();
      const scaled = rendered.width > RECEIPT_WIDTH ? await ImageManipulator.manipulate(input).resize({ width: RECEIPT_WIDTH }).renderAsync() : rendered;
      const saved = await scaled.saveAsync({ compress: RECEIPT_QUALITY, format: SaveFormat.JPEG, base64: Platform.OS === 'web' });
      if (Platform.OS === 'web') {
        const dataUri = `data:image/jpeg;base64,${saved.base64}`;
        const blob = await (await fetch(dataUri)).blob();
        return { upload: blob, previewUri: dataUri };
      }
      return { upload: { uri: saved.uri }, previewUri: saved.uri };
    } catch (e) {
      // Chrome and Firefox can't decode HEIC; Android and Safari can. Say why instead of a vague failure.
      if (heic) return { error: "This browser can't open HEIC photos. Save the photo as JPG or PNG, or use the Android app." };
      throw e;
    } finally {
      revoke?.();
    }
  } catch {
    return { error: 'Could not read that photo. Try again, or enter the items by hand.' };
  }
}

/** Saves a small copy of an already-taken photo as the item's shelf thumbnail. Returns undefined if it can't. */
export async function saveThumbnail(uri: string): Promise<string | undefined> {
  try {
    const rendered = await ImageManipulator.manipulate(uri).resize({ width: SIZE }).renderAsync();
    if (Platform.OS === 'web') {
      const saved = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: true });
      return saved.base64 ? `data:image/jpeg;base64,${saved.base64}` : undefined;
    }
    const saved = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
    const dir = new Directory(Paths.document, 'food-photos');
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new FsFile(dir, `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`);
    await new FsFile(saved.uri).copy(dest);
    return dest.uri;
  } catch {
    return undefined;
  }
}

/** Best-effort removal of a stored photo file (web data URIs need no cleanup). */
export function deleteFoodPhoto(uri: string | undefined) {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const f = new FsFile(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone; nothing to do.
  }
}

/** The in-process Tesseract (tesseract.js) used where the OCR container can't run, on the sample receipt. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalOcr } from '../src/ocr-local.js';
import { createReceiptScanner } from '../src/receipts.js';
import { fakeGemini } from './fakes.js';

const receipt = readFileSync(new URL('../../../docs/demo/sample-receipt.png', import.meta.url));

describe('in-process OCR', () => {
  const ocr = createLocalOcr();

  it('reads the sample receipt line by line, with single spaces like the container', async () => {
    const { lines } = await ocr.read(receipt, 'receipt.png', 'image/png');
    const text = lines.map((l) => l.text);
    expect(text).toContain('WHOLE MILK 2L £2.15');
    expect(text).toContain('TOTAL GBP £26.29');
    expect(text.every((t) => !/\s{2}/.test(t))).toBe(true);
    expect(lines.every((l) => l.confidence > 0 && l.confidence <= 1)).toBe(true);
  }, 60_000);

  it('feeds the receipt rules the same way, with AI off', async () => {
    const scan = await createReceiptScanner(ocr, fakeGemini(() => ({}), false)).scan({ image: receipt, filename: 'receipt.png', contentType: 'image/png', useAi: false });
    expect(scan.source).toBe('rules');
    expect(scan.lines.length).toBeGreaterThanOrEqual(8);
  }, 60_000);

  it('refuses something that is not an image without bringing the process down', async () => {
    await expect(ocr.read(Buffer.from('not an image'), 'x.png', 'image/png')).rejects.toMatchObject({ code: 'bad_image' });
    // Still works afterwards.
    expect((await ocr.read(receipt, 'receipt.png', 'image/png')).lines.length).toBeGreaterThan(10);
  }, 60_000);
});

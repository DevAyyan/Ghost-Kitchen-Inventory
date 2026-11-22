import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { OcrError, type Ocr, type OcrLine } from './ocr.js';

/**
 * Tesseract in-process (tesseract.js, WebAssembly), for hosts that can't run the OCR container (Vercel).
 * Same engine and settings as infra/ocr: the LSTM model and one uniform block of text (psm 6). The English
 * data is bundled (@tesseract.js-data/eng), so nothing is downloaded at run time. One worker per process,
 * made on first use and reused; jobs queue on it.
 */
const require = createRequire(import.meta.url);
const LANG_PATH = join(dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');

export function createLocalOcr(): Ocr {
  let worker: Promise<Worker> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const getWorker = () => {
    worker ??= (async () => {
      // errorHandler: without one, a job's error is rethrown on the worker thread and takes the process
      // down. With it, the job's promise rejects and the request gets a plain error.
      const w = await createWorker('eng', OEM.LSTM_ONLY, { langPath: LANG_PATH, gzip: true, cachePath: join(tmpdir(), 'tesseract'), errorHandler: () => {} });
      await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
      return w;
    })().catch((e) => { worker = null; throw e; });
    return worker;
  };

  return {
    read(image) {
      const job = queue.then(async () => {
        let w: Worker;
        try {
          w = await getWorker();
        } catch {
          throw new OcrError('unreachable', 'The text reader could not start.');
        }
        let data;
        try {
          ({ data } = await w.recognize(image, {}, { blocks: true, text: true }));
        } catch {
          throw new OcrError('bad_image', 'That does not look like a usable image.');
        }
        const lines: OcrLine[] = (data.blocks ?? [])
          .flatMap((b) => b.paragraphs.flatMap((p) => p.lines))
          // Single spaces between words, as the container gives: receipt rules don't expect column gaps.
          .map((l) => ({ text: l.text.replace(/\s+/g, ' ').trim(), confidence: Math.max(0, Math.min(1, l.confidence / 100)) }))
          .filter((l) => l.text.length > 0);
        return { lines, text: lines.map((l) => l.text).join('\n') };
      });
      queue = job.catch(() => {});
      return job;
    },
    // In-process: available as long as the module loads. Starting it is left to the first scan.
    async ping() { return true; },
  };
}

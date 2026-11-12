export interface OcrLine {
  text: string;
  /** Tesseract's average word confidence for the line, 0..1. */
  confidence: number;
}

export interface OcrResult {
  lines: OcrLine[];
  text: string;
}

export interface Ocr {
  read(image: Buffer, filename: string, contentType: string): Promise<OcrResult>;
  ping(): Promise<boolean>;
}

export class OcrError extends Error {
  constructor(public code: 'unreachable' | 'bad_image' | 'failed', message: string) {
    super(message);
    this.name = 'OcrError';
  }
}

/** Client for the Tesseract container in infra/ocr. */
export function createOcr(baseUrl: string, doFetch: typeof fetch = fetch): Ocr {
  const root = baseUrl.replace(/\/$/, '');
  return {
    async read(image, filename, contentType) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(image)], { type: contentType }), filename);
      let res: Response;
      try {
        res = await doFetch(`${root}/ocr`, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
      } catch {
        throw new OcrError('unreachable', 'The text-reading service is not reachable.');
      }
      if (res.status === 400 || res.status === 413) throw new OcrError('bad_image', 'That does not look like a usable image.');
      if (!res.ok) throw new OcrError('failed', `The text-reading service failed (HTTP ${res.status}).`);
      const data = (await res.json()) as { text?: string; lines?: { text: string; confidence: number }[] };
      const lines = (data.lines ?? [])
        .map((l) => ({ text: l.text.trim(), confidence: Math.max(0, Math.min(1, l.confidence)) }))
        .filter((l) => l.text.length > 0);
      return { lines, text: data.text ?? lines.map((l) => l.text).join('\n') };
    },
    async ping() {
      try {
        const res = await doFetch(`${root}/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

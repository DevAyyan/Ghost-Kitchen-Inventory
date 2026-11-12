import type { Category, Life, Zone } from './types';

/** Storage facts for one product, from Gemini via POST /v1/products/info (mirrors the server type). */
export interface ProductInfo {
  name: string;
  category: Category;
  homeZone: Zone;
  shelfLifeDays: Life;
  highRisk: boolean;
  multiUse: boolean;
  tags: string[];
  tip: string;
}

/** Same normalisation as the server's productKey, so client and server caches agree. */
export function productKey(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
}

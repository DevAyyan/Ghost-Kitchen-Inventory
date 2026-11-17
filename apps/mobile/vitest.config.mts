import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the app's pure TypeScript (lib/domain, store migrations). No React Native here:
// components are checked in the browser; the logic that decides what's safe and what's kept is tested here.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Dates are local-time calendar days; run in a zone with DST to catch off-by-one-day bugs.
    env: { TZ: 'Europe/London' },
  },
});

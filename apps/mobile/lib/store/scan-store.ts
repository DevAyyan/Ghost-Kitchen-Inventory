import type { Draft, DraftLine } from '@/lib/domain/draft';
import { create } from 'zustand';

interface ScanState {
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  patchDraft: (patch: Partial<Draft>) => void;
  patchLine: (id: string, patch: Partial<DraftLine>) => void;
  addLine: (line: DraftLine) => void;
  removeLine: (id: string) => void;
}

/** In-progress receipt review. Not persisted: an abandoned scan should not come back. */
export const useScan = create<ScanState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  patchDraft: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : s)),
  patchLine: (id, patch) =>
    set((s) => (s.draft ? { draft: { ...s.draft, lines: s.draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } } : s)),
  addLine: (line) => set((s) => (s.draft ? { draft: { ...s.draft, lines: [...s.draft.lines, line] } } : s)),
  removeLine: (id) => set((s) => (s.draft ? { draft: { ...s.draft, lines: s.draft.lines.filter((l) => l.id !== id) } } : s)),
}));

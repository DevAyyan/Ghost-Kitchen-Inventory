import type { IsoDate, Receipt } from './types';

export interface BudgetStatus {
  /** Spent so far this month, in the budget's currency. */
  spentMinor: number;
  budgetMinor: number;
  /** 0..1+; above 1 means over budget. */
  used: number;
  leftMinor: number;
  over: boolean;
  /** Days remaining in the month including today, for a "per day" hint. */
  daysLeft: number;
}

/** Receipts dated in the same calendar month as `now` ("2026-11-17" matches "2026-11-02"). */
export const receiptsThisMonth = (receipts: Receipt[], now: IsoDate) => receipts.filter((r) => r.date.slice(0, 7) === now.slice(0, 7));

export function daysLeftInMonth(now: IsoDate): number {
  const [y, m, d] = now.split('-').map(Number) as [number, number, number];
  return new Date(y, m, 0).getDate() - d + 1;
}

/** Spend against the budget. Null when there is no budget or the spend can't be put in the budget's currency. */
export function budgetStatus(spentMinor: number | null, budgetMinor: number, now: IsoDate): BudgetStatus | null {
  if (budgetMinor <= 0 || spentMinor === null) return null;
  return {
    spentMinor, budgetMinor,
    used: spentMinor / budgetMinor,
    leftMinor: budgetMinor - spentMinor,
    over: spentMinor > budgetMinor,
    daysLeft: daysLeftInMonth(now),
  };
}

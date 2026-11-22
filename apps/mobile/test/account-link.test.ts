import { describe, expect, it } from 'vitest';
import { deleteAllPlan, linkAction } from '@/lib/domain/account-link';

describe('a device following its account', () => {
  it('syncs when it is already in the account kitchen', () => {
    expect(linkAction('k1', 'k1')).toBe('sync');
    expect(linkAction('k1', 'k1', true)).toBe('sync');
  });
  it('adds its food on its first sign-in, so nothing on it is lost', () => {
    expect(linkAction(null, 'k1')).toBe('merge');
    expect(linkAction(null, 'k1', true)).toBe('merge');
  });
  it('takes the kitchen the account moved to, when another device got it there', () => {
    expect(linkAction('old', 'family')).toBe('replace');
  });
  it('brings its copy along when it is first to find the account was removed or left', () => {
    expect(linkAction('old', 'fresh', true)).toBe('merge');
  });
});

describe('delete all data, signed in', () => {
  it('clears everywhere when it is only you, and leaves first when others share the kitchen', () => {
    expect(deleteAllPlan(1)).toBe('clear-everywhere');
    expect(deleteAllPlan(3)).toBe('leave-then-clear');
  });
});

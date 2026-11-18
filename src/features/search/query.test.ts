import { describe, expect, it } from 'vitest';
import { normalizeQuery } from './query';

describe('normalizeQuery', () => {
  it('returns null for empty, blank, short, long or missing input', () => {
    expect(normalizeQuery('   ')).toBeNull();
    expect(normalizeQuery('a')).toBeNull();
    expect(normalizeQuery(' a ')).toBeNull();
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery(undefined)).toBeNull();
    expect(normalizeQuery('x'.repeat(101))).toBeNull();
  });

  it('trims and collapses whitespace, keeping accents and symbols', () => {
    expect(normalizeQuery('  coração   selvagem ')).toBe('coração selvagem');
    expect(normalizeQuery('a&b')).toBe('a&b');
    expect(normalizeQuery('x'.repeat(100))).toHaveLength(100);
    expect(normalizeQuery('ab')).toBe('ab');
  });
});

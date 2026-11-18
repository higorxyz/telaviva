import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRecent, readRecent, saveRecent } from './recent';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('recent searches', () => {
  it('dedupes case-insensitively, puts the latest first, caps at 8 and clears', () => {
    saveRecent('Matrix');
    saveRecent('dune');
    saveRecent('MATRIX');
    expect(readRecent()).toEqual(['MATRIX', 'dune']);
    for (let i = 0; i < 10; i++) saveRecent(`termo ${i}`);
    expect(readRecent()).toHaveLength(8);
    clearRecent();
    expect(readRecent()).toEqual([]);
  });

  it('survives corrupt data and a throwing localStorage', () => {
    window.localStorage.setItem('telaviva:recent-searches', '{oops');
    expect(readRecent()).toEqual([]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readRecent()).toEqual([]);
    expect(() => saveRecent('matrix')).not.toThrow();
  });
});

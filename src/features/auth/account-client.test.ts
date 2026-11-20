import { afterEach, describe, expect, it } from 'vitest';
import { clearLocalAccountData } from './account-client';

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('clearLocalAccountData', () => {
  it("removes the visitor's library even when the uid is no longer known", () => {
    window.localStorage.setItem('telaviva:library:v1', '{}');
    window.localStorage.setItem('telaviva:library:v1:pre-merge:u1', '{}');
    clearLocalAccountData(null);
    expect(window.localStorage.getItem('telaviva:library:v1')).toBeNull();
    expect(window.localStorage.getItem('telaviva:library:v1:pre-merge:u1')).toBe('{}');
  });
});

import { describe, expect, it } from 'vitest';
import { previousBuildFiles } from './static-reserve';

const SITE = 'https://telaviva.vercel.app';

describe('previousBuildFiles', () => {
  it('picks the build files the new precache list no longer has', () => {
    const cached = [
      `${SITE}/_next/static/chunks/old-1.js`,
      `${SITE}/_next/static/chunks/shared.js`,
      `${SITE}/_next/static/css/old.css`,
    ];
    const current = new Set([`${SITE}/_next/static/chunks/shared.js`, `${SITE}/_next/static/chunks/new-1.js`]);
    expect(previousBuildFiles(cached, current)).toEqual([
      `${SITE}/_next/static/chunks/old-1.js`,
      `${SITE}/_next/static/css/old.css`,
    ]);
  });

  it('ignores precached pages, which are revisioned and never needed by an old tab', () => {
    const cached = [`${SITE}/~offline?__WB_REVISION__=abc`];
    expect(previousBuildFiles(cached, new Set([`${SITE}/~offline?__WB_REVISION__=def`]))).toEqual([]);
  });
});

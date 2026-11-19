import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';

const poster = readFileSync(path.join(process.cwd(), 'e2e', 'assets', 'poster.jpg'));

/** `test` with external hosts stubbed (TMDb and YouTube images, the YouTube player), so specs never hit the network. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/^https:\/\/(image\.tmdb\.org|i\.ytimg\.com)\//, (route) =>
      route.fulfill({ status: 200, contentType: 'image/jpeg', body: poster }),
    );
    await page.route(/^https:\/\/www\.youtube-nocookie\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Player</title>' }),
    );
    await provide(page);
  },
});

export { expect };

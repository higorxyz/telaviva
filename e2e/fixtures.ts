import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';

const poster = readFileSync(path.join(process.cwd(), 'e2e', 'assets', 'poster.jpg'));

/** `test` with external image hosts stubbed, so specs never depend on the network. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/^https:\/\/(image\.tmdb\.org|i\.ytimg\.com)\//, (route) =>
      route.fulfill({ status: 200, contentType: 'image/jpeg', body: poster }),
    );
    await provide(page);
  },
});

export { expect };

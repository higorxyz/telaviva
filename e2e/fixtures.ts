import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Page } from '@playwright/test';

const poster = readFileSync(path.join(process.cwd(), 'e2e', 'assets', 'poster.jpg'));

/** Stubs the external hosts (TMDb and YouTube images, the YouTube player), so a page never hits the network. */
export async function stubExternalHosts(page: Page): Promise<void> {
  await page.route(/^https:\/\/(image\.tmdb\.org|i\.ytimg\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: poster }),
  );
  await page.route(/^https:\/\/www\.youtube-nocookie\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Player</title>' }),
  );
}

/** `test` with external hosts stubbed, so specs never hit the network. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await stubExternalHosts(page);
    await provide(page);
  },
});

export { expect };

import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

export async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
}

/** Waits for entrance animations to finish, so contrast is measured on the settled colors. */
export async function settled(target: Locator): Promise<void> {
  await target.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
}

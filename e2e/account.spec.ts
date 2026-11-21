import type { Locator, Page } from '@playwright/test';
import { authTest as test, markVerified, signIn } from './auth-helpers';
import { expect } from './fixtures';

/* The account page and the e-mail confirmation notice, against the Firebase Auth emulator and the E2E PGlite. */

const MOVIE = '/filme/550-clube-da-luta';

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  expect(found).not.toBeNull();
  return found!;
}

const overlaps = (a: { y: number; height: number }, b: { y: number; height: number }) =>
  a.y < b.y + b.height && b.y < a.y + a.height;

/** The toast stack's settled layout (the entry animation is 240 ms). */
const settle = (page: Page) => page.waitForTimeout(400);

test('going Back with the deletion dialog open closes it, and the page behind takes clicks', async ({ page, accounts }) => {
  await signIn(page, await accounts.create('voltar', { verified: true }));
  await page.getByRole('link', { name: 'Sua conta' }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await page.getByRole('button', { name: 'Excluir minha conta' }).click();
  await expect(page.getByRole('dialog', { name: 'Excluir minha conta' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/minha-lista/);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  // Nothing is left inert: the header link works, and /conta comes back with the dialog closed.
  await page.getByRole('link', { name: 'Sua conta' }).click();
  await expect(page).toHaveURL(/\/conta$/);
  await expect(page.getByRole('button', { name: 'Excluir minha conta' })).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('the confirmation notice sits under the toasts, above the TabBar, never over the title', async ({ page, accounts, isMobile }) => {
  await signIn(page, await accounts.create('aviso'));
  await page.goto(MOVIE);
  const notice = page.getByRole('region', { name: 'Confirmação de e-mail' });
  await expect(notice).toBeVisible();
  await page.getByRole('button', { name: 'Quero ver', exact: true }).click();
  const toast = page.locator('[data-toast]').filter({ hasText: 'Salvo em Quero ver' });
  await expect(toast).toBeVisible();
  await settle(page);

  const [noticeBox, toastBox, title] = await Promise.all([
    box(notice),
    box(toast),
    box(page.getByRole('heading', { level: 1 })),
  ]);
  const viewport = page.viewportSize()!;
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(noticeBox.y + 1);
  expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(viewport.height);
  expect(overlaps(noticeBox, title)).toBe(false);
  if (isMobile) {
    const tabBar = await box(page.getByRole('navigation', { name: 'Navegação principal' }));
    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(tabBar.y + 1);
  } else {
    expect(noticeBox.x + noticeBox.width).toBeGreaterThan(viewport.width - 64);
  }

  // /conta offers the same resend beside the status, and the notice stays off there (one button, one cooldown).
  await page.goto('/conta');
  await expect(page.getByText('E-mail não confirmado')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reenviar e-mail' })).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('button', { name: 'Reenviar e-mail' })).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test('once the e-mail is confirmed, the next full load shows no notice, not even for a moment', async ({ page, accounts }) => {
  const user = await accounts.create('confirmado');
  await signIn(page, user);
  const notice = page.getByRole('region', { name: 'Confirmação de e-mail' });
  await expect(notice).toBeVisible();

  await markVerified(user.uid);
  // The notice asks Firebase again on this load; it now says confirmed, and a session saying so is minted.
  const minted = page.waitForResponse((r) => r.url().endsWith('/api/auth/session') && r.request().method() === 'POST');
  await page.reload();
  await minted;
  await expect(notice).toHaveCount(0);

  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('[aria-label="Confirmação de e-mail"]')) sessionStorage.setItem('saw-notice', '1');
    }).observe(document, { subtree: true, childList: true });
  });
  await page.goto(MOVIE);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sua conta' })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => sessionStorage.getItem('saw-notice'))).toBeNull();
});

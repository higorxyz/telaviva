import { authTest as test, signUp } from './auth-helpers';
import { expect } from './fixtures';
import { savedItemCount } from './library-state';

/*
 * The race behind the sign-up flakes of e2e/auth.spec.ts under load, made certain: the account's first library load
 * reads the list on the server before the guest merge writes to it, and answers only after the merge did. The merge's
 * reload must drop that load (src/features/library/reload-query.ts), or the list shows without the visitor's titles.
 */
test('the list the merge saved shows even when the first load of the account read it before the merge', async ({
  page,
  accounts,
}) => {
  await page.goto('/filme/550-clube-da-luta');
  await page.getByRole('button', { name: 'Quero ver', exact: true }).click();
  await expect.poll(() => savedItemCount(page)).toBe(1);

  let firstLoadRead!: () => void;
  const read = new Promise<void>((resolve) => (firstLoadRead = resolve));
  let mergeAnnounced!: () => void;
  const announced = new Promise<void>((resolve) => (mergeAnnounced = resolve));
  let held = false;
  // The first GET reaches the server at once (it reads the empty list), and its answer is held until the merge is done.
  await page.route('**/api/library', async (route) => {
    if (route.request().method() !== 'GET' || held) return route.continue();
    held = true;
    const response = await route.fetch();
    firstLoadRead();
    await announced;
    await route.fulfill({ response });
  });
  // The merge goes only once that read happened.
  await page.route('**/api/library/merge', async (route) => {
    await read;
    await route.continue();
  });

  await signUp(page, accounts.fresh('corrida'));
  await expect(page.getByText('Sua lista foi salva na sua conta.')).toBeVisible();
  mergeAnnounced();
  await expect(page.getByRole('tabpanel').getByRole('link', { name: /^Clube da Luta/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tabpanel').getByRole('link', { name: /^Clube da Luta/ })).toBeVisible();
});

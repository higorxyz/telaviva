import type { Page, Request, Response } from '@playwright/test';
import { pageGet } from './auth-helpers';
import { expect } from './fixtures';
import { pickSeriesStatus, SERIES_ID } from './offline-helpers';

/* The account side of e2e/offline-account.spec.ts: the server's copy of the list and the device's offline store. */

export type ServerLibrary = {
  items: { mediaType: string; tmdbId: number; status: string }[];
  episodes: { tvId: number; seasonNumber: number; episodeNumber: number }[];
};

export const isCommand = (r: Request) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/library/commands';
const savedCommand = (r: Response) => isCommand(r.request()) && r.ok();

/** Runs `act` and waits until the account saved its command (the screen changes before the server answers). */
export async function saving(page: Page, act: () => Promise<void>): Promise<void> {
  const saved = page.waitForResponse(savedCommand);
  await act();
  await saved;
}

/** The account's library as the server holds it, read with this page's session. */
export async function serverLibrary(page: Page, uid: string): Promise<ServerLibrary> {
  const { status, body } = await pageGet(page, '/api/library', { 'X-Expected-User': uid });
  expect(status).toBe(200);
  return body as ServerLibrary;
}

/** Ids of `uid`'s actions in the device's offline queue (src/features/offline/store.ts), once the app created it. */
export const queuedIds = (page: Page, uid: string) =>
  page.evaluate(
    (owner) =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('telaviva-offline', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const all = db.transaction('queue').objectStore('queue').index('uid').getAll(owner);
          all.onsuccess = () => resolve((all.result as { id: string }[]).map((item) => item.id));
          all.onerror = () => reject(all.error);
          all.transaction!.oncomplete = () => db.close();
        };
      }),
    uid,
  );

/** The series' status in the account's copy on the device (null: not in it), the list shown when offline. */
const copyStatus = (page: Page, uid: string) =>
  page.evaluate(
    ([owner, id]) =>
      new Promise<string | null>((resolve, reject) => {
        const open = indexedDB.open('telaviva-offline', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction('snapshots').objectStore('snapshots').get(owner);
          get.onsuccess = () => {
            const items = (get.result?.state.items ?? []) as { mediaType: string; tmdbId: number; status: string }[];
            resolve(items.find((i) => i.mediaType === 'tv' && i.tmdbId === id)?.status ?? null);
          };
          get.onerror = () => reject(get.error);
          get.transaction!.oncomplete = () => db.close();
        };
      }),
    [uid, SERIES_ID] as const,
  );

/** "Assistindo" on the series page, saved by the server and then in the copy on the device (written after the answer). */
export async function startWatching(page: Page, uid: string): Promise<void> {
  await saving(page, () => pickSeriesStatus(page, 'Assistindo'));
  await expect.poll(() => copyStatus(page, uid)).toBe('watching');
}

export const seriesOf = (library: ServerLibrary) => ({
  items: library.items.filter((i) => i.mediaType === 'tv' && i.tmdbId === SERIES_ID),
  episodes: library.episodes.filter((e) => e.tvId === SERIES_ID),
});

export const signedIn = (page: Page) => page.getByRole('link', { name: 'Sua conta' });
export const signInLink = (page: Page) => page.getByRole('banner').getByRole('link', { name: 'Entrar', exact: true });
export const addButton = (page: Page) => page.getByRole('button', { name: 'Adicionar à lista', exact: true });

/**
 * The worker `/serwist/sw.js` serves when the emergency switch `NEXT_PUBLIC_SW_DISABLED=1` is set at build time
 * (src/app/serwist/[path]/route.ts). A browser checks its worker's script on its own (on navigations, at least once a
 * day), without running any of the page's new JavaScript; when it finds this one instead, the installed worker is
 * replaced by it, and it removes itself:
 *
 * - `install`: takes over at once, without waiting for the open tabs to close;
 * - `activate`: deletes this site's caches (`tv-*` and Serwist's `serwist-*`, the same as ServiceWorker.tsx), claims
 *   the open tabs, unregisters, and reloads each open window, which then loads from the network with no worker.
 *
 * It has no `fetch` listener: until the reload, every request goes straight to the network.
 *
 * Plain JavaScript in a string, served as is: nothing to bundle, so the route stays prerendered without Serwist's
 * build step, and the precache list is never part of it.
 */
export const KILL_SWITCH_WORKER = `// TelaViva: the offline worker is switched off (NEXT_PUBLIC_SW_DISABLED=1). This worker removes itself.
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('tv-') || name.startsWith('serwist-')).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => undefined)));
    })(),
  );
});
`;

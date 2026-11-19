/* Warms the production server once, serially: the first request of each route renders (and caches) it, which is
 * slow when six workers race for it on a cold server. */
const ROUTES = [
  '/',
  '/filmes',
  '/series',
  '/buscar',
  '/descobrir',
  '/generos',
  '/genero/filme/28-acao',
  '/filme/550-clube-da-luta',
  '/serie/1399-game-of-thrones?temporada=1',
  '/pessoa/287-brad-pitt',
];

export default async function globalSetup(): Promise<void> {
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:3100';
  for (const route of ROUTES) {
    await fetch(`${base}${route}`, { signal: AbortSignal.timeout(120_000) });
  }
}

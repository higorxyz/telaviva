import { clearEmulatorAccounts } from './auth-helpers';
import { APP_URL } from './e2e-env';

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
  '/entrar',
  '/conta',
  '/minha-lista',
];

/**
 * Runs after the web servers are up (Playwright starts them first). The database was already replaced by a fresh,
 * migrated PGlite inside the app's webServer command (e2e/prepare-db.ts), before `next start` could open it; here the
 * emulator loses the accounts a reused emulator may still hold from an earlier run.
 */
export default async function globalSetup(): Promise<void> {
  await clearEmulatorAccounts();
  const base = process.env.E2E_BASE_URL ?? APP_URL;
  for (const route of ROUTES) {
    const res = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`E2E warm-up failed: GET ${route} -> HTTP ${res.status}`);
  }
}

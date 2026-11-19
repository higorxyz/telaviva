import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Each test declares its TMDb responses via `server.use(...)`. The one default: every title can be watched in
 * Brazil (the feed asks `watch/providers` per title), so tests about other things never depend on availability.
 * Tests about availability override it (see `./providers`).
 */
export const server = setupServer(
  http.get('https://api.themoviedb.org/3/:media/:id/watch/providers', ({ params }) =>
    HttpResponse.json({
      id: Number(params.id),
      results: { BR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }] } },
    }),
  ),
);

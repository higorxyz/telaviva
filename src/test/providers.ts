import { http, HttpResponse } from 'msw';
import { server } from './server';

const BASE = 'https://api.themoviedb.org/3';
const NETFLIX = { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' };

/** The per-title `watch/providers` answer: a BR subscription offer, or no BR entry at all. */
export function providersBody(id: number, availableInBr: boolean) {
  return { id, results: availableInBr ? { BR: { link: 'https://www.themoviedb.org', flatrate: [NETFLIX] } } : {} };
}

/** Handler for every title's `watch/providers` (default: available in BR). */
export const watchProvidersHandler = (isAvailable: (id: number) => boolean = () => true, asked?: string[]) =>
  http.get(`${BASE}/:media/:id/watch/providers`, ({ params }) => {
    const id = Number(params.id);
    asked?.push(`${String(params.media)}:${id}`);
    return HttpResponse.json(providersBody(id, isAvailable(id)));
  });

/** From here on only even ids can be watched in Brazil (like the E2E mock). Returns the `media:id` keys asked. */
export function onlyEvenAvailableInBr(): string[] {
  const asked: string[] = [];
  server.use(watchProvidersHandler((id) => id % 2 === 0, asked));
  return asked;
}

/** From here on nothing can be watched in Brazil. Returns the `media:id` keys asked. */
export function nothingAvailableInBr(): string[] {
  const asked: string[] = [];
  server.use(watchProvidersHandler(() => false, asked));
  return asked;
}

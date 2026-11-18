import { getMovieList, getTrending } from '@/features/tmdb/movies';
import { getTvList } from '@/features/tmdb/tv';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { mediaKey } from './media-key';

export interface RailInput {
  id: string;
  title: { lead: string; accent?: string };
  href?: string;
  items: MediaSummary[];
}
export type RailOutput = RailInput;

const MIN_ITEMS = 6;
export const PER_RAIL = 14;

/** Keeps each title in the first rail that has it; `exclude` holds `${mediaType}:${id}` keys. */
export function dedupeRails(
  rails: RailInput[],
  opts: { perRail: number; exclude?: string[] },
): RailOutput[] {
  const seen = new Set(opts.exclude ?? []);
  const out: RailOutput[] = [];
  for (const rail of rails) {
    const items: MediaSummary[] = [];
    const taken = new Set<string>();
    for (const item of rail.items) {
      const key = mediaKey(item);
      if (seen.has(key) || taken.has(key)) continue;
      taken.add(key);
      items.push(item);
      if (items.length === opts.perRail) break;
    }
    // Titles of a dropped rail stay available to later rails.
    if (items.length < MIN_ITEMS) continue;
    taken.forEach((k) => seen.add(k));
    out.push({ ...rail, items });
  }
  return out;
}

export type Source = {
  id: string;
  title: RailInput['title'];
  href: string;
  fetch: () => Promise<Paginated<MediaSummary>>;
};

// Order is the dedupe priority.
const SOURCES: Source[] = [
  { id: 'bombando-hoje', title: { lead: 'Bombando', accent: 'hoje' }, href: '/filmes/em-alta', fetch: () => getTrending('all', 'day') },
  { id: 'em-cartaz', title: { lead: 'Nos', accent: 'cinemas' }, href: '/filmes/em-cartaz', fetch: () => getMovieList('now_playing') },
  { id: 'series-em-alta', title: { lead: 'Séries', accent: 'em alta' }, href: '/series/em-alta', fetch: () => getTrending('tv', 'week') },
  { id: 'streaming-br', title: { lead: 'No streaming', accent: 'no Brasil' }, href: '/filmes/no-streaming', fetch: () => getMovieList('streaming_br') },
  { id: 'series-no-ar', title: { lead: 'Séries', accent: 'no ar esta semana' }, href: '/series/em-exibicao', fetch: () => getTvList('on_the_air') },
  { id: 'joias-escondidas', title: { lead: 'Joias', accent: 'escondidas' }, href: '/filmes/joias-escondidas', fetch: () => getMovieList('hidden_gems') },
  { id: 'classicos-validados', title: { lead: 'Clássicos', accent: 'validados' }, href: '/filmes/mais-bem-avaliados', fetch: () => getMovieList('top_rated') },
  { id: 'series-aclamadas', title: { lead: 'Séries', accent: 'aclamadas' }, href: '/series/mais-bem-avaliadas', fetch: () => getTvList('top_rated') },
  { id: 'curtos-para-hoje', title: { lead: 'Curtos', accent: 'para hoje' }, href: '/filmes/curtos', fetch: () => getMovieList('short') },
  { id: 'grandes-bilheterias', title: { lead: 'Grandes', accent: 'bilheterias' }, href: '/filmes/blockbusters', fetch: () => getMovieList('blockbusters') },
  { id: 'em-breve', title: { lead: 'Em', accent: 'breve' }, href: '/filmes/em-breve', fetch: () => getMovieList('upcoming') },
];

/** Loads every source; a rejected one drops only its own rail (logged under `scope`). Sources are cached, this is not. */
export async function settleRails(sources: Source[], scope: string): Promise<RailInput[]> {
  const settled = await Promise.allSettled(sources.map((s) => s.fetch()));
  const rails: RailInput[] = [];
  settled.forEach((result, i) => {
    const source = sources[i]!;
    if (result.status === 'rejected') {
      console.error(`[${scope}] rail "${source.id}" dropped:`, result.reason);
      return;
    }
    rails.push({ id: source.id, title: source.title, href: source.href, items: result.value.results });
  });
  return rails;
}

export const loadHomeRails = () => settleRails(SOURCES, 'home');

export async function buildHomeRails(exclude: string[] = []): Promise<RailOutput[]> {
  return dedupeRails(await loadHomeRails(), { perRail: PER_RAIL, exclude });
}

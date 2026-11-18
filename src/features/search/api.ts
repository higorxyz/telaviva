import type { Paginated, SearchItem } from '@/features/tmdb/types';

export async function fetchSearchPage(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<Paginated<SearchItem>> {
  const url = new URL('/api/search', window.location.origin);
  url.searchParams.set('q', query);
  url.searchParams.set('page', String(page));
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Falha na busca (${res.status})`);
  return (await res.json()) as Paginated<SearchItem>;
}

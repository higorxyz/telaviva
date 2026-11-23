import type { MediaSummary } from '@/features/tmdb/types';

/** What a poster card reads of a title: its link, label, poster, ring, badge and the "Quero ver" snapshot. */
export type CardItem = Pick<
  MediaSummary,
  'id' | 'mediaType' | 'title' | 'posterPath' | 'releaseDate' | 'voteAverage' | 'genreIds'
>;

/**
 * Only the card fields of a title. A server component hands this to a client rail, so the page's RSC payload (inlined
 * in its HTML, and parsed before hydration) carries no synopsis, original title or other field no card shows: on
 * the home page that was about half of the payload.
 */
export function toCardItem(item: CardItem): CardItem {
  const { id, mediaType, title, posterPath, releaseDate, voteAverage, genreIds } = item;
  return { id, mediaType, title, posterPath, releaseDate, voteAverage, genreIds };
}

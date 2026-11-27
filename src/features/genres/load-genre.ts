import { notFound } from 'next/navigation';
import { assertCanonical } from '@/features/detail/canonical';
import { getGenres } from '@/features/tmdb/genres';
import type { Genre, MediaType } from '@/features/tmdb/types';
import { genreHref } from '@/lib/slug';
import { findGenre, mediaOfTipo, tipoOf, type Tipo } from './genres';

export interface ResolvedGenre {
  media: MediaType;
  tipo: Tipo;
  genre: Genre;
  href: string;
}

/** 404 for a bad `tipo` or unknown genre id; never reads searchParams, so redirects/404s keep their real status. */
export async function resolveGenre(params: Promise<{ tipo: string; slug: string }>): Promise<ResolvedGenre & { slug: string }> {
  const { tipo, slug } = await params;
  const media = mediaOfTipo(tipo);
  if (!media) notFound();
  const genre = findGenre(await getGenres(media), slug);
  if (!genre) notFound();
  return { media, tipo: tipoOf(media), genre, href: genreHref({ mediaType: media, ...genre }), slug };
}

/** `resolveGenre` plus the 308 to the canonical slug. */
export async function loadCanonicalGenre(params: Promise<{ tipo: string; slug: string }>): Promise<ResolvedGenre> {
  const resolved = await resolveGenre(params);
  assertCanonical(resolved.slug, resolved.href);
  return resolved;
}

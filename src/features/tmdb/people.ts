import { cacheLife, cacheTag } from 'next/cache';
import { isTmdbNotFound, TmdbError, tmdbFetch } from './client';
import { biographyOnlySchema, personSchema } from './detail-schemas';
import { toMediaSummary, withTextFallback } from './mappers';
import { isSafe, movieSchema, tvSchema } from './schemas';
import type { MediaSummary, PersonCredit, PersonDetails } from './types';

const MAX_IMAGES = 12;

function parseCredit(
  raw: unknown,
  roleKey: 'character' | 'job',
  fallbackDepartment: string,
): PersonCredit | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let summary: MediaSummary | null = null;
  if (r.media_type === 'movie') {
    const p = movieSchema.safeParse(raw);
    summary = p.success && isSafe(p.data) ? toMediaSummary(p.data, 'movie') : null;
  } else if (r.media_type === 'tv') {
    const p = tvSchema.safeParse(raw);
    summary = p.success && isSafe(p.data) ? toMediaSummary(p.data, 'tv') : null;
  }
  if (!summary) return null;
  const role = r[roleKey];
  const department = r.department;
  return {
    ...summary,
    role: typeof role === 'string' ? role : '',
    department: typeof department === 'string' ? department : fallbackDepartment,
  };
}

/** A TMDb 404 is returned as a value (errors lose their class across 'use cache') and rethrown by getPerson. */
async function loadPerson(id: number): Promise<PersonDetails | null> {
  'use cache';
  cacheTag('tmdb', `person:${id}`);
  try {
    const raw = await tmdbFetch(
      `person/${id}`,
      { append_to_response: 'combined_credits,images' },
      personSchema,
    );
    const credits = [
      ...(raw.combined_credits?.cast ?? []).map((c) => parseCredit(c, 'character', 'Acting')),
      ...(raw.combined_credits?.crew ?? []).map((c) => parseCredit(c, 'job', '')),
    ]
      .filter((c): c is PersonCredit => c !== null)
      .sort((a, b) => b.popularity - a.popularity);
    const { biography } = await withTextFallback({ biography: raw.biography }, 'biography', () =>
      tmdbFetch(`person/${id}`, { language: 'en-US' }, biographyOnlySchema),
    );
    cacheLife('tmdbDetail');
    return {
      id: raw.id,
      name: raw.name,
      biography,
      birthday: raw.birthday,
      deathday: raw.deathday,
      placeOfBirth: raw.place_of_birth,
      profilePath: raw.profile_path,
      knownForDepartment: raw.known_for_department,
      alsoKnownAs: raw.also_known_as,
      credits,
      images: (raw.images?.profiles ?? []).slice(0, MAX_IMAGES).map((p) => p.file_path),
    };
  } catch (error) {
    if (isTmdbNotFound(error)) {
      cacheLife('hours');
      return null;
    }
    throw error;
  }
}

export async function getPerson(id: number): Promise<PersonDetails> {
  const person = await loadPerson(id);
  if (!person) throw new TmdbError('The resource you requested could not be found.', 404, `person/${id}`);
  return person;
}

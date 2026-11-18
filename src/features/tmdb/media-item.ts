import { movieSchema, tvSchema } from './schemas';
import { toMediaSummary } from './mappers';
import type { MediaSummary, SearchItem } from './types';

/** Parses a `media_type`-tagged TMDb item into a MediaSummary; unknown or malformed items become null. */
export function parseMediaItem(raw: unknown): MediaSummary | null {
  if (!raw || typeof raw !== 'object' || !('media_type' in raw)) return null;
  if (raw.media_type === 'movie') {
    const parsed = movieSchema.safeParse(raw);
    return parsed.success ? toMediaSummary(parsed.data, 'movie') : null;
  }
  if (raw.media_type === 'tv') {
    const parsed = tvSchema.safeParse(raw);
    return parsed.success ? toMediaSummary(parsed.data, 'tv') : null;
  }
  return null;
}

export function parseSearchItem(raw: unknown): SearchItem | null {
  const media = parseMediaItem(raw);
  if (media) return media;
  if (!raw || typeof raw !== 'object' || !('media_type' in raw) || raw.media_type !== 'person') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'number' || typeof r.name !== 'string') return null;
  return {
    mediaType: 'person',
    id: r.id,
    name: r.name,
    profilePath: typeof r.profile_path === 'string' ? r.profile_path : null,
    knownForDepartment: typeof r.known_for_department === 'string' ? r.known_for_department : null,
  };
}

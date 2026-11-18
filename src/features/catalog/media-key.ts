import type { MediaSummary } from '@/features/tmdb/types';

export const mediaKey = (m: Pick<MediaSummary, 'mediaType' | 'id'>) => `${m.mediaType}:${m.id}`;

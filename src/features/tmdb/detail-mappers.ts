import { brCertification, brTvRating, pickTrailer } from '@/features/catalog/curation';
import type {
  RawEpisode,
  RawMovieDetail,
  RawTvDetail,
  RawVideos,
} from './detail-schemas';
import { toMediaSummary } from './mappers';
import type {
  CastMember,
  EpisodeSummary,
  MovieDetails,
  Provider,
  TvDetails,
  Video,
  WatchProviders,
} from './types';

const MAX_CAST = 20;

type RawProviders = RawMovieDetail['watch/providers'];

function toVideos(videos: RawVideos | undefined): Video[] {
  return (videos?.results ?? []).map((v) => ({
    key: v.key,
    site: v.site,
    type: v.type,
    official: v.official,
    language: v.iso_639_1,
    name: v.name,
  }));
}

function toProviders(raw: RawProviders): WatchProviders {
  const br = raw?.results.BR;
  const list = (items: { provider_id: number; provider_name: string; logo_path: string | null }[] = []): Provider[] =>
    items.map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
  return {
    link: br?.link ?? null,
    flatrate: list(br?.flatrate),
    free: list(br?.free),
    ads: list(br?.ads),
    rent: list(br?.rent),
    buy: list(br?.buy),
  };
}

function toCast(
  raw: { id: number; name: string; profile_path: string | null; order: number }[],
  character: (index: number) => string,
): CastMember[] {
  return raw
    .map((c, i) => ({ id: c.id, name: c.name, character: character(i), profilePath: c.profile_path, order: c.order }))
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_CAST);
}

export function toEpisode(raw: RawEpisode): EpisodeSummary {
  return {
    seasonNumber: raw.season_number,
    episodeNumber: raw.episode_number,
    name: raw.name,
    overview: raw.overview,
    airDate: raw.air_date,
    stillPath: raw.still_path,
    runtime: raw.runtime,
    voteAverage: raw.vote_average,
  };
}

export function toMovieDetails(raw: RawMovieDetail): MovieDetails {
  const base = toMediaSummary(raw, 'movie');
  const cast = raw.credits?.cast ?? [];
  return {
    ...base,
    genreIds: raw.genres.map((g) => g.id),
    runtime: raw.runtime,
    tagline: raw.tagline,
    genres: raw.genres,
    certification: raw.release_dates ? brCertification(raw.release_dates) : null,
    trailer: pickTrailer(toVideos(raw.videos)),
    cast: toCast(cast, (i) => cast[i]!.character),
    providers: toProviders(raw['watch/providers']),
    recommendations: (raw.recommendations?.results ?? []).map((r) => toMediaSummary(r, 'movie')),
    imdbId: raw.imdb_id,
    budget: raw.budget,
    revenue: raw.revenue,
  };
}

export function toTvDetails(raw: RawTvDetail): TvDetails {
  const base = toMediaSummary(raw, 'tv');
  const cast = raw.aggregate_credits?.cast ?? [];
  return {
    ...base,
    genreIds: raw.genres.map((g) => g.id),
    tagline: raw.tagline,
    genres: raw.genres,
    certification: raw.content_ratings ? brTvRating(raw.content_ratings) : null,
    trailer: pickTrailer(toVideos(raw.videos)),
    cast: toCast(cast, (i) => cast[i]!.roles[0]?.character ?? ''),
    providers: toProviders(raw['watch/providers']),
    recommendations: (raw.recommendations?.results ?? []).map((r) => toMediaSummary(r, 'tv')),
    status: raw.status,
    inProduction: raw.in_production,
    numberOfSeasons: raw.number_of_seasons,
    numberOfEpisodes: raw.number_of_episodes,
    seasons: raw.seasons.map((s) => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
      airDate: s.air_date,
      posterPath: s.poster_path,
    })),
    nextEpisodeToAir: raw.next_episode_to_air ? toEpisode(raw.next_episode_to_air) : null,
    lastEpisodeToAir: raw.last_episode_to_air ? toEpisode(raw.last_episode_to_air) : null,
    episodeRunTime: raw.episode_run_time[0] ?? null,
  };
}

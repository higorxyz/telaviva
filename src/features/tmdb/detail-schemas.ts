import { z } from 'zod';
import { moviePageSchema, movieSchema, tvPageSchema, tvSchema } from './schemas';

// Schemas for the detail endpoints (append_to_response sub-resources included).

const str = z.string().nullish().transform((v) => v ?? '');
const optStr = z.string().nullish().transform((v) => v || null);
const optNum = z.number().nullish().transform((v) => v ?? null);

export const genresSchema = z.array(z.object({ id: z.number(), name: z.string() })).catch([]);

export const videosSchema = z
  .object({
    results: z.array(
      z.object({
        key: z.string(),
        site: z.string(),
        type: z.string().catch(''),
        official: z.boolean().catch(false),
        iso_639_1: str,
        name: z.string().catch(''),
      }),
    ),
  })
  .optional();

const providerSchema = z.object({
  provider_id: z.number(),
  provider_name: z.string(),
  logo_path: optStr,
});

const providerRegionSchema = z.object({
  link: optStr,
  flatrate: z.array(providerSchema).catch([]),
  free: z.array(providerSchema).catch([]),
  ads: z.array(providerSchema).catch([]),
  rent: z.array(providerSchema).catch([]),
  buy: z.array(providerSchema).catch([]),
});

export const watchProvidersSchema = z.object({ results: z.record(z.string(), providerRegionSchema) }).optional();

export const releaseDatesSchema = z.object({
  results: z.array(
    z.object({
      iso_3166_1: z.string(),
      release_dates: z.array(z.object({ certification: str, type: z.number().catch(0) })),
    }),
  ),
});

export const contentRatingsSchema = z.object({
  results: z.array(z.object({ iso_3166_1: z.string(), rating: str })),
});

export const episodeSchema = z.object({
  season_number: z.number(),
  episode_number: z.number(),
  name: z.string().catch(''),
  overview: str,
  air_date: optStr,
  still_path: optStr,
  runtime: optNum,
  vote_average: z.number().catch(0),
});

export const seasonSchema = z.object({
  season_number: z.number(),
  name: z.string().catch(''),
  overview: str,
  episodes: z.array(episodeSchema).catch([]),
});

const creditsSchema = z.object({
  cast: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      character: str,
      profile_path: optStr,
      order: z.number().catch(999),
    }),
  ),
});

const aggregateCreditsSchema = z.object({
  cast: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      roles: z.array(z.object({ character: str })).catch([]),
      profile_path: optStr,
      order: z.number().catch(999),
    }),
  ),
});

export const movieDetailSchema = movieSchema.extend({
  runtime: optNum,
  tagline: str,
  genres: genresSchema,
  imdb_id: optStr,
  budget: z.number().catch(0),
  revenue: z.number().catch(0),
  videos: videosSchema,
  credits: creditsSchema.optional(),
  release_dates: releaseDatesSchema.optional(),
  'watch/providers': watchProvidersSchema,
  recommendations: moviePageSchema.optional(),
});

export const tvDetailSchema = tvSchema.extend({
  tagline: str,
  genres: genresSchema,
  status: str,
  in_production: z.boolean().catch(false),
  number_of_seasons: z.number().catch(0),
  number_of_episodes: z.number().catch(0),
  seasons: z
    .array(
      z.object({
        season_number: z.number(),
        name: z.string().catch(''),
        episode_count: z.number().catch(0),
        air_date: optStr,
        poster_path: optStr,
      }),
    )
    .catch([]),
  next_episode_to_air: episodeSchema.nullish().catch(null),
  last_episode_to_air: episodeSchema.nullish().catch(null),
  episode_run_time: z.array(z.number()).catch([]),
  videos: videosSchema,
  aggregate_credits: aggregateCreditsSchema.optional(),
  content_ratings: contentRatingsSchema.optional(),
  'watch/providers': watchProvidersSchema,
  recommendations: tvPageSchema.optional(),
});

export const overviewOnlySchema = z.object({ overview: str });

export const personSchema = z.object({
  id: z.number(),
  name: z.string(),
  biography: str,
  birthday: optStr,
  deathday: optStr,
  place_of_birth: optStr,
  profile_path: optStr,
  known_for_department: optStr,
  also_known_as: z.array(z.string()).catch([]),
  combined_credits: z
    .object({ cast: z.array(z.unknown()).catch([]), crew: z.array(z.unknown()).catch([]) })
    .optional(),
  images: z.object({ profiles: z.array(z.object({ file_path: z.string() })).catch([]) }).optional(),
});

export const providerCatalogSchema = z.object({
  results: z.array(
    z.object({
      provider_id: z.number(),
      provider_name: z.string(),
      logo_path: optStr,
      display_priorities: z.record(z.string(), z.number()).catch({}),
    }),
  ),
});

export type RawReleaseDates = z.infer<typeof releaseDatesSchema>;
export type RawContentRatings = z.infer<typeof contentRatingsSchema>;
export type RawVideos = NonNullable<z.infer<typeof videosSchema>>;
export type RawMovieDetail = z.infer<typeof movieDetailSchema>;
export type RawTvDetail = z.infer<typeof tvDetailSchema>;
export type RawEpisode = z.infer<typeof episodeSchema>;
export type RawPerson = z.infer<typeof personSchema>;

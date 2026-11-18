import { z } from 'zod';

// Zod objects strip unknown keys: only the fields we use are declared.
// TMDb omits or nulls many values (poster, overview, dates), hence the defaults.

const mediaCommon = {
  id: z.number(),
  overview: z.string().nullish().transform((v) => v ?? ''),
  poster_path: z.string().nullish().transform((v) => v ?? null),
  backdrop_path: z.string().nullish().transform((v) => v ?? null),
  vote_average: z.number().catch(0),
  vote_count: z.number().catch(0),
  popularity: z.number().catch(0),
  genre_ids: z.array(z.number()).catch([]),
  original_language: z.string().catch(''),
};

export const movieSchema = z.object({
  ...mediaCommon,
  title: z.string(),
  original_title: z.string().catch(''),
  release_date: z.string().nullish().transform((v) => v || null),
});

export const tvSchema = z.object({
  ...mediaCommon,
  name: z.string(),
  original_name: z.string().catch(''),
  first_air_date: z.string().nullish().transform((v) => v || null),
});

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    page: z.number(),
    total_pages: z.number(),
    total_results: z.number(),
    results: z.array(item),
  });

export const moviePageSchema = pageSchema(movieSchema);
export const tvPageSchema = pageSchema(tvSchema);

export const genreListSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })),
});

export type RawMovie = z.infer<typeof movieSchema>;
export type RawTv = z.infer<typeof tvSchema>;
export interface RawPage<R> {
  page: number;
  total_pages: number;
  total_results: number;
  results: R[];
}

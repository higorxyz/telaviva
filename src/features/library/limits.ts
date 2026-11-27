/** Caps on a signed-in user's library (plan, "Valores fixados"). Past them the server answers 413. */
export const LIBRARY_LIMITS = {
  items: 5_000,
  ratings: 5_000,
  marks: 60_000,
  marksPerSetEpisodes: 2_000,
} as const;

/** Largest Postgres `integer`: ids, seasons and episodes past it could never be stored. */
export const PG_INT_MAX = 2_147_483_647;

/**
 * Size of a saved title snapshot, so no row can grow without bound (one account must not fill the free database).
 * TMDb's own values fit comfortably; `fitSnapshot` trims anything longer before it is saved.
 */
export const SNAPSHOT_LIMITS = {
  title: 300,
  posterPath: 200,
  /** An ISO date: YYYY-MM-DD. */
  releaseDate: 10,
  genreIds: 20,
} as const;

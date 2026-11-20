/** Caps on a signed-in user's library (plan, "Valores fixados"). Past them the server answers 413. */
export const LIBRARY_LIMITS = {
  items: 5_000,
  ratings: 5_000,
  marks: 60_000,
  marksPerSetEpisodes: 2_000,
} as const;

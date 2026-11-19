/** Shape of the TMDb data series progress is derived from. Functions arrive in Task 2. */
export interface TvProgressInfo {
  tvId: number;
  ended: boolean;
  seasons: { seasonNumber: number; episodeCount: number }[];
  lastAired: { seasonNumber: number; episodeNumber: number } | null;
  nextToAir: { seasonNumber: number; episodeNumber: number; airDate: string | null } | null;
}

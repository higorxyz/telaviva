const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type ImageSize =
  | 'w92'
  | 'w154'
  | 'w185'
  | 'w300'
  | 'w342'
  | 'w500'
  | 'w780'
  | 'w1280'
  | 'h632'
  | 'original';

export function tmdbImage(path: string | null, size: ImageSize): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

function srcSet(path: string | null, entries: [ImageSize, number][]): string | undefined {
  if (!path) return undefined;
  return entries.map(([size, width]) => `${tmdbImage(path, size)} ${width}w`).join(', ');
}

export function posterSrcSet(path: string | null): string | undefined {
  return srcSet(path, [
    ['w185', 185],
    ['w342', 342],
    ['w500', 500],
    ['w780', 780],
  ]);
}

/** Full-bleed heroes: `original` (up to 3840px) keeps wide and high-DPR screens sharp instead of upscaling w1280. */
export function backdropSrcSet(path: string | null): string | undefined {
  return srcSet(path, [
    ['w780', 780],
    ['w1280', 1280],
    ['original', 3840],
  ]);
}

/** Cast photos (2:3). The CDN serves any configured width for any image kind. */
export function profileSrcSet(path: string | null): string | undefined {
  return srcSet(path, [
    ['w185', 185],
    ['w342', 342],
  ]);
}

/** Episode stills (16:9); `original` is left out on purpose (often 1920px and ~300 KB per episode). */
export function stillSrcSet(path: string | null): string | undefined {
  return srcSet(path, [
    ['w300', 300],
    ['w500', 500],
    ['w780', 780],
  ]);
}

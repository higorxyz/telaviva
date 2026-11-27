import { OG_SIZE } from '@/features/share/og';
import { brandJpeg, FULL_CACHE } from '@/features/share/og-route';

export const alt = 'TelaViva — filmes e séries';
export const size = OG_SIZE;
export const contentType = 'image/jpeg';

/** Branded share card for the home, inherited by every static page without its own image. */
export default function Image() {
  return brandJpeg(FULL_CACHE);
}

import { OG_SIZE } from '@/features/share/og';
import { shareImage } from '@/features/share/og-route';

export const alt = 'Cartaz e nota do título no TelaViva';
export const size = OG_SIZE;
export const contentType = 'image/jpeg';

/** Same single prerendered slug as the page; other ids render on demand and fall back to the brand card. */
export function generateStaticParams() {
  return [{ slug: '550-clube-da-luta' }];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return shareImage(slug, 'filme');
}

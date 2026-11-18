import type { MetadataRoute } from 'next';
import { TOKENS } from '@/ui/tokens';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TelaViva',
    short_name: 'TelaViva',
    description: 'Descubra filmes e séries, com onde assistir no Brasil.',
    lang: 'pt-BR',
    start_url: '/',
    display: 'standalone',
    background_color: TOKENS.ink950,
    theme_color: TOKENS.ink950,
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

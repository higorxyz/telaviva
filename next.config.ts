import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: false,
  reactCompiler: true,
  images: { unoptimized: true },
  cacheLife: {
    tmdbHot: { stale: 300, revalidate: 3600, expire: 86400 },
    tmdbDetail: { stale: 3600, revalidate: 86400, expire: 604800 },
    tmdbStatic: { stale: 86400, revalidate: 604800, expire: 2592000 },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: false,
  reactCompiler: true,
  images: { unoptimized: true },
  // Fonts read with fs by the share-image and icon routes (keys are picomatch route globs, contains-matched).
  outputFileTracingIncludes: {
    '/opengraph-image': ['src/assets/fonts/*.ttf'],
    '/apple-icon': ['src/assets/fonts/*.ttf'],
    '/icons/*': ['src/assets/fonts/*.ttf'],
  },
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

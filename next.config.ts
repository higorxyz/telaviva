import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: false,
  reactCompiler: true,
  images: { unoptimized: true },
  // Firebase's sign-in helper served from this site, so the Google redirect works without third-party cookies
  // (Safari/iOS, installed PWA). Read when the config loads; absent without a project id (sign-in off).
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) return [];
    return [{ source: '/__/auth/:path*', destination: `https://${projectId}.firebaseapp.com/__/auth/:path*` }];
  },
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

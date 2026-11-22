import { withSerwist } from '@serwist/turbopack';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The E2E build (playwright.config.ts) goes to its own directory with its own tsconfig, so its fake Firebase config
  // and emulator host never end up in the real `.next`, the one `npm run start` and `vercel deploy --prebuilt` use.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.NEXT_TSCONFIG_PATH || 'tsconfig.json' },
  cacheComponents: true,
  partialPrefetching: false,
  reactCompiler: true,
  images: { unoptimized: true },
  // Firebase's sign-in helper served from this site, so the Google redirect works without third-party cookies
  // (Safari/iOS, installed PWA). Read when the config loads; absent without a project id (sign-in off). The id must
  // be a plain host label, so it can never point the proxy at another host.
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) return [];
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
    // The service worker (src/app/serwist/[path]/route.ts) is built once per deploy: regenerating it later would run
    // in a function without its source or the build files. Infinity = never.
    serwist: { revalidate: Infinity, expire: Infinity },
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

// Keeps esbuild, which bundles the service worker (src/app/serwist/[path]/route.ts), out of the server bundle.
export default withSerwist(nextConfig);

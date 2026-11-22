import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createSerwistRoute } from '@serwist/turbopack';
import { cacheLife } from 'next/cache';

/**
 * Revision of the precached offline page: the deployed commit on Vercel, else a hash of the page's source. Never
 * `git`, which a build machine may not have. `||`, not `??`: `vercel env pull` writes an empty commit SHA locally.
 */
const offlineRevision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  createHash('sha256')
    .update(readFileSync(path.join(process.cwd(), 'src/app/~offline/page.tsx')))
    .digest('hex');

const serwist = createSerwistRoute({
  additionalPrecacheEntries: [{ url: '/~offline', revision: offlineRevision }],
  swSrc: 'src/sw/sw.ts',
  useNativeEsbuild: true,
});

// Only the worker files (sw.js and its source map) exist.
export const { generateStaticParams, dynamicParams } = serwist;

/**
 * The worker bundled from src/sw/sw.ts with the build's precache list. Cached so the build prerenders it: with Cache
 * Components, Serwist's `dynamic = 'force-static'` does nothing, and the route would bundle at request time from
 * files (the worker source, `.next/static`) that a serverless function does not have.
 */
async function serwistFile(file: string): Promise<{ body: string; contentType: string }> {
  'use cache';
  cacheLife('max');
  const response = await serwist.GET(new Request('http://localhost/'), { params: Promise.resolve({ path: file }) });
  return { body: await response.text(), contentType: response.headers.get('Content-Type') ?? 'text/plain' };
}

export async function GET(_: Request, { params }: RouteContext<'/serwist/[path]'>) {
  const { body, contentType } = await serwistFile((await params).path);
  return new Response(body, { headers: { 'Content-Type': contentType, 'Service-Worker-Allowed': '/' } });
}

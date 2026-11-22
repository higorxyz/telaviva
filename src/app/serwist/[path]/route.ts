import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createSerwistRoute } from '@serwist/turbopack';
import { cacheLife } from 'next/cache';
import { OFFLINE_URL, PRECACHED_PAGES } from '@/sw/precached-pages';

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

// Revisions: the deployed commit on Vercel, else a local fallback. Never `git`, which a build machine may not have.
// `||`, not `??`: `vercel env pull` writes an empty commit SHA locally.
const commit = process.env.VERCEL_GIT_COMMIT_SHA;

/** The offline page: its source decides its content. */
const offlineRevision = commit || sha256(readFileSync(path.join(process.cwd(), 'src/app/~offline/page.tsx')));

const serwist = createSerwistRoute({
  additionalPrecacheEntries: [{ url: OFFLINE_URL, revision: offlineRevision }],
  manifestTransforms: [
    // `/` and `/minha-lista` render layout, shared components and data, so a hash of their own source would miss most
    // changes. Locally their revision is a fingerprint of the build: every build file's URL is content-hashed.
    async (entries) => {
      const build = sha256(entries.map((entry) => `${entry.url} ${entry.revision ?? ''}`).sort().join('\n'));
      const revision = commit || build;
      return { manifest: [...entries, ...PRECACHED_PAGES.map((url) => ({ url, revision, size: 0 }))], warnings: [] };
    },
  ],
  swSrc: 'src/sw/sw.ts',
  useNativeEsbuild: true,
});

// Only the worker files (sw.js and its source map) exist.
export const { generateStaticParams, dynamicParams } = serwist;

/**
 * The worker bundled from src/sw/sw.ts with the build's precache list. Cached so the build prerenders it: with Cache
 * Components, Serwist's `dynamic = 'force-static'` does nothing, and the route would bundle at request time from
 * files (the worker source, `.next/static`) that a serverless function does not have. The `serwist` profile never
 * revalidates nor expires (next.config.ts) for the same reason: each deploy builds it again. Throws instead of caching
 * a failed or empty bundle.
 */
async function serwistFile(file: string): Promise<{ body: string; contentType: string }> {
  'use cache';
  cacheLife('serwist');
  const response = await serwist.GET(new Request('http://localhost/'), { params: Promise.resolve({ path: file }) });
  const body = await response.text();
  if (!response.ok || body.length === 0) throw new Error(`Serwist could not build /serwist/${file} (${response.status})`);
  return { body, contentType: response.headers.get('Content-Type') ?? 'text/plain' };
}

export async function GET(_: Request, { params }: RouteContext<'/serwist/[path]'>) {
  const { body, contentType } = await serwistFile((await params).path);
  return new Response(body, { headers: { 'Content-Type': contentType, 'Service-Worker-Allowed': '/' } });
}

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createSerwistRoute } from '@serwist/turbopack';
import { cacheLife } from 'next/cache';
import { KILL_SWITCH_WORKER } from '@/sw/kill-switch';
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

type WorkerFile = { body: string; contentType: string; status: number };

/**
 * With the emergency switch (`NEXT_PUBLIC_SW_DISABLED=1`, read at build time), `sw.js` is a worker that removes itself
 * (src/sw/kill-switch.ts) and there is no source map. Browsers that installed the offline worker find it on their own
 * next update check, so the switch works even for a tab that never loads the new page code.
 */
function killSwitchFile(file: string): WorkerFile {
  if (file !== 'sw.js') return { body: '', contentType: 'text/plain; charset=utf-8', status: 404 };
  return { body: KILL_SWITCH_WORKER, contentType: 'application/javascript; charset=utf-8', status: 200 };
}

/**
 * The worker bundled from src/sw/sw.ts with the build's precache list. Cached so the build prerenders it: with Cache
 * Components, Serwist's `dynamic = 'force-static'` does nothing, and the route would bundle at request time from
 * files (the worker source, `.next/static`) that a serverless function does not have. The `serwist` profile never
 * revalidates nor expires (next.config.ts) for the same reason: each deploy builds it again. Throws instead of caching
 * a failed or empty bundle.
 */
async function serwistFile(file: string): Promise<WorkerFile> {
  'use cache';
  cacheLife('serwist');
  if (process.env.NEXT_PUBLIC_SW_DISABLED === '1') return killSwitchFile(file);
  const response = await serwist.GET(new Request('http://localhost/'), { params: Promise.resolve({ path: file }) });
  const body = await response.text();
  if (!response.ok || body.length === 0) throw new Error(`Serwist could not build /serwist/${file} (${response.status})`);
  return { body, contentType: response.headers.get('Content-Type') ?? 'text/plain', status: 200 };
}

export async function GET(_: Request, { params }: RouteContext<'/serwist/[path]'>) {
  const { body, contentType, status } = await serwistFile((await params).path);
  return new Response(status === 404 ? null : body, {
    status,
    headers: { 'Content-Type': contentType, 'Service-Worker-Allowed': '/' },
  });
}

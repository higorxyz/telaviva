// Read by next.config.ts when the config loads (Node, build and `next start`): plain values only, no app imports.

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };

/** Firebase's sign-in helper, proxied from `<project>.firebaseapp.com` (next.config.ts `rewrites`). */
export const AUTH_HELPER_PATHS = '/__/auth/:path*';

/** Sent with every response, the sign-in helper included. */
const EVERYWHERE: Header[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

/**
 * Every path but the sign-in helper. The Firebase SDK loads `/__/auth/iframe` in a hidden iframe of this very site
 * (the auth domain is the site itself, through the proxy), so blocking framing there would break signing in; and its
 * pages run Firebase's own scripts, which this site's CSP does not describe.
 */
const OUTSIDE_AUTH_HELPER = '/((?!__/auth/).*)';

/**
 * An allowlist CSP. No nonces or hashes: a nonce forces every page to render per request (no static shell, no
 * prerender), and the inline scripts Next writes into static pages change with every build. So inline scripts stay
 * allowed; what the policy buys is that nothing loads, connects, frames or submits outside the hosts listed here:
 * TMDb images, YouTube thumbnails and player, Google avatars, Firebase (APIs, `apis.google.com` and the sign-in
 * helper, served by this site in production and by `<project>.firebaseapp.com` locally) and, on the machine itself,
 * the Auth emulator. Development adds `'unsafe-eval'`, which React needs there. Checked in the E2E suite and on the
 * real build (docs/audits/2026-11-fase4-seguranca-a11y.md).
 */
export function contentSecurityPolicy(env: Record<string, string | undefined> = process.env): string {
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseApp = projectId && /^[a-z0-9-]+$/.test(projectId) ? ` https://${projectId}.firebaseapp.com` : '';
  const emulatorHost = env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  const emulator = emulatorHost && /^[a-z0-9.-]+:\d+$/i.test(emulatorHost) ? ` http://${emulatorHost}` : '';
  const dev = env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://apis.google.com${dev}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://image.tmdb.org https://i.ytimg.com https://*.googleusercontent.com",
    "font-src 'self'",
    `connect-src 'self' https://*.googleapis.com https://apis.google.com https://image.tmdb.org https://i.ytimg.com${emulator}`,
    `frame-src 'self' https://www.youtube-nocookie.com${firebaseApp}${emulator}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(): HeaderRule[] {
  return [
    { source: '/:path*', headers: EVERYWHERE },
    {
      source: OUTSIDE_AUTH_HELPER,
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
      ],
    },
  ];
}

// Client-safe: only NEXT_PUBLIC_* values, each read as a direct `process.env.NEXT_PUBLIC_X`
// reference so Next inlines it into the bundle. Never import server-only modules here.
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;

export type PublicFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** `localhost`, `127.0.0.1` or `::1`: the machine itself (local dev and E2E). */
export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

/**
 * The `authDomain` the Firebase SDK should use. The SDK always opens `https://<authDomain>/__/auth/handler`, which a
 * local `http` server can never serve, so a machine-local domain maps to Firebase's own `<projectId>.firebaseapp.com`
 * (its redirect URI is registered by default). Any other value (the same-site proxy on Vercel) is kept as configured,
 * as is anything unparseable or a local domain without a project id to map to.
 */
export function effectiveAuthDomain(configured: string | undefined, projectId: string | undefined): string {
  const value = (configured ?? '').trim();
  if (!value || !projectId) return value;
  let hostname: string;
  try {
    hostname = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`).hostname;
  } catch {
    return value;
  }
  return isLocalHostname(hostname) ? `${projectId}.firebaseapp.com` : value;
}

export const publicFirebaseConfig: PublicFirebaseConfig | null =
  apiKey && authDomain && projectId && appId
    ? { apiKey, authDomain: effectiveAuthDomain(authDomain, projectId), projectId, appId }
    : null;

export const authEnabled: boolean = publicFirebaseConfig !== null;

export const authEmulatorHost: string | null = emulatorHost || null;

/**
 * True when this page may talk to the Auth emulator: only on the machine itself. The emulator signs nothing, so a
 * build that inlined an emulator host by mistake (an E2E build deployed, say) must refuse to sign in anywhere else
 * rather than send people's passwords to a local port.
 */
export function emulatorAllowedHere(): boolean {
  return typeof window !== 'undefined' && isLocalHostname(window.location.hostname);
}

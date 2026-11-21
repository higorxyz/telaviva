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

export const publicFirebaseConfig: PublicFirebaseConfig | null =
  apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;

export const authEnabled: boolean = publicFirebaseConfig !== null;

export const authEmulatorHost: string | null = emulatorHost || null;

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** `localhost`, `127.0.0.1` or `::1`: the machine itself (local dev and E2E). */
export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}

/**
 * True when this page may talk to the Auth emulator: only on the machine itself. The emulator signs nothing, so a
 * build that inlined an emulator host by mistake (an E2E build deployed, say) must refuse to sign in anywhere else
 * rather than send people's passwords to a local port.
 */
export function emulatorAllowedHere(): boolean {
  return typeof window !== 'undefined' && isLocalHostname(window.location.hostname);
}

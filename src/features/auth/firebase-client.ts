import type { Auth } from 'firebase/auth';
import { authEmulatorHost, publicFirebaseConfig } from '@/lib/auth-config';

/**
 * The Firebase SDK, loaded on demand. This is the only module that imports `firebase/*`, and only through `import()`,
 * so a visitor who never signs in never downloads it (the bundler puts it in its own chunks).
 */

export type AuthSdk = typeof import('firebase/auth');
export type FirebaseClient = { auth: Auth; sdk: AuthSdk };

let loading: Promise<FirebaseClient> | null = null;
let loaded = false;
/** Kept across a failed load: Firebase refuses a second `initializeAuth` on the same app. */
let created: Auth | null = null;

async function init(): Promise<FirebaseClient> {
  if (!publicFirebaseConfig) throw new Error('Sign-in is not configured');
  const [{ getApps, initializeApp }, sdk] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] ?? initializeApp(publicFirebaseConfig);
  // initializeAuth instead of getAuth: only the persistence and resolver used here end up in the chunk.
  let auth = created;
  if (!auth) {
    auth = sdk.initializeAuth(app, {
      persistence: sdk.browserLocalPersistence,
      popupRedirectResolver: sdk.browserPopupRedirectResolver,
    });
    if (authEmulatorHost) sdk.connectAuthEmulator(auth, `http://${authEmulatorHost}`, { disableWarnings: true });
    created = auth;
  }
  // currentUser is only meaningful once the persisted user has been read.
  await auth.authStateReady();
  loaded = true;
  return { auth, sdk };
}

/** The SDK and the Auth instance, loaded once. A failed load (offline, say) may be tried again. */
export function loadFirebase(): Promise<FirebaseClient> {
  if (!loading) {
    const attempt = init();
    loading = attempt;
    attempt.catch(() => {
      if (loading === attempt) loading = null;
    });
  }
  return loading;
}

/** Starts the download early (the sign-in page calls it), so the popup still opens within the click's gesture. */
export function preloadFirebase(): void {
  loadFirebase().catch(() => {});
}

export function isFirebaseLoaded(): boolean {
  return loaded;
}

/** Tests only: forget the loaded instance. */
export function resetFirebaseClient(): void {
  loading = null;
  loaded = false;
  created = null;
}

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

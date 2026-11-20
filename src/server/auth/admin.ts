import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { serverAuthEnv } from '@/lib/env';
import { SetupError } from '@/lib/setup-error';

const APP_NAME = 'telaviva';

const globalForAuth = globalThis as typeof globalThis & { __telavivaAdminAuth?: Auth };

function createApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const { firebase } = serverAuthEnv();
  if (!firebase) {
    throw new SetupError(
      'Firebase não configurado: defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
    );
  }

  // With FIREBASE_AUTH_EMULATOR_HOST set, firebase-admin talks to the emulator and accepts its unsigned tokens.
  // That must never happen in production, where it would let anyone forge a token.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    if (process.env.VERCEL) {
      throw new SetupError(
        'FIREBASE_AUTH_EMULATOR_HOST não pode ser usado na Vercel (o emulador é só para testes).',
      );
    }
    // The emulator needs only the project id, so tests can use a fake key that is never parsed.
    return initializeApp({ projectId: firebase.projectId }, APP_NAME);
  }

  let credential: ReturnType<typeof cert>;
  try {
    credential = cert(firebase);
  } catch (cause) {
    // Only the code is kept: the original message is firebase-admin's and could, in some version, quote the key.
    const code = (cause as { code?: unknown } | null)?.code;
    throw new SetupError(
      `Credencial do Firebase inválida${typeof code === 'string' ? ` (${code})` : ''}: confira FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.`,
      { cause },
    );
  }
  return initializeApp({ credential }, APP_NAME);
}

/** firebase-admin Auth for the named `telaviva` app, cached on globalThis so dev hot reloads reuse it. */
export function getAdminAuth(): Auth {
  globalForAuth.__telavivaAdminAuth ??= getAuth(createApp());
  return globalForAuth.__telavivaAdminAuth;
}

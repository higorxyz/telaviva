import { SessionRequestError } from './session-client';

// Firebase Auth error codes → the sign-in copy (plan, "Valores fixados"). `null` means: show nothing.

export const GENERIC_AUTH_ERROR = 'Não foi possível entrar agora. Tente de novo.';

export const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';
export const WEAK_PASSWORD = 'Use uma senha com pelo menos 8 caracteres.';
export const INVALID_EMAIL = 'Confira o e-mail digitado.';
export const TOO_MANY_REQUESTS = 'Muitas tentativas. Espere um pouco e tente de novo.';
export const OFFLINE = 'Sem conexão. Verifique sua internet.';

const MESSAGES: Readonly<Record<string, string | null>> = {
  'auth/invalid-credential': WRONG_CREDENTIALS,
  'auth/wrong-password': WRONG_CREDENTIALS,
  'auth/user-not-found': WRONG_CREDENTIALS,
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
  'auth/weak-password': WEAK_PASSWORD,
  'auth/invalid-email': INVALID_EMAIL,
  'auth/too-many-requests': TOO_MANY_REQUESTS,
  'auth/network-request-failed': OFFLINE,
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
};

/** The `code` of a Firebase error (they all carry one), or null for anything else. */
export function authErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

/** The message to show for a failed sign-in, or null when the user closed the popup themselves. */
export function authErrorMessage(error: unknown): string | null {
  const code = authErrorCode(error);
  return code !== null && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_AUTH_ERROR;
}

/** Firebase answers that mean the signed-in user cannot get a token any more (not a passing network problem). */
const SESSION_ENDING_CODES = new Set([
  'auth/user-token-expired',
  'auth/invalid-user-token',
  'auth/user-disabled',
  'auth/user-not-found',
]);

/**
 * True when a failed renewal is a definitive answer (the server refused the token, or Firebase says the user is gone).
 * Anything else (offline, a chunk that did not load, a 5xx) may pass, and must not sign the user out.
 */
export function endsSession(error: unknown): boolean {
  if (error instanceof SessionRequestError) return error.status === 401;
  const code = authErrorCode(error);
  return code !== null && SESSION_ENDING_CODES.has(code);
}

// Firebase Auth error codes → the sign-in copy (plan, "Valores fixados"). `null` means: show nothing.

export const GENERIC_AUTH_ERROR = 'Não foi possível entrar agora. Tente de novo.';

const WRONG_CREDENTIALS = 'E-mail ou senha incorretos.';

const MESSAGES: Readonly<Record<string, string | null>> = {
  'auth/invalid-credential': WRONG_CREDENTIALS,
  'auth/wrong-password': WRONG_CREDENTIALS,
  'auth/user-not-found': WRONG_CREDENTIALS,
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
  'auth/weak-password': 'Use uma senha com pelo menos 8 caracteres.',
  'auth/invalid-email': 'Confira o e-mail digitado.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
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

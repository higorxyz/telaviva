import { describe, expect, it } from 'vitest';
import { authErrorMessage, GENERIC_AUTH_ERROR } from './errors';
import { authError } from './test-firebase';

describe('authErrorMessage', () => {
  it.each([
    ['auth/invalid-credential', 'E-mail ou senha incorretos.'],
    ['auth/wrong-password', 'E-mail ou senha incorretos.'],
    ['auth/user-not-found', 'E-mail ou senha incorretos.'],
    ['auth/email-already-in-use', 'Já existe uma conta com esse e-mail.'],
    ['auth/weak-password', 'Use uma senha com pelo menos 8 caracteres.'],
    ['auth/invalid-email', 'Confira o e-mail digitado.'],
    ['auth/too-many-requests', 'Muitas tentativas. Espere um pouco e tente de novo.'],
    ['auth/network-request-failed', 'Sem conexão. Verifique sua internet.'],
  ])('maps %s to its exact copy', (code, message) => {
    expect(authErrorMessage(authError(code))).toBe(message);
  });

  it.each(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])('shows nothing for %s', (code) => {
    expect(authErrorMessage(authError(code))).toBeNull();
  });

  it('falls back to the generic copy for any other code, a plain error or a non-error', () => {
    expect(GENERIC_AUTH_ERROR).toBe('Não foi possível entrar agora. Tente de novo.');
    expect(authErrorMessage(authError('auth/internal-error'))).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(authError('toString'))).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage(new Error('boom'))).toBe(GENERIC_AUTH_ERROR);
    expect(authErrorMessage('x')).toBe(GENERIC_AUTH_ERROR);
  });
});

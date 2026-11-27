import { describe, expect, it } from 'vitest';
import { describeError, SetupError } from './setup-error';

describe('describeError', () => {
  it('prints the whole message of a SetupError', () => {
    expect(describeError(new SetupError('Banco de dados não configurado.'))).toBe(
      'SetupError: Banco de dados não configurado.',
    );
  });

  it('prints only name and code of anything else, which may quote a token or user data', () => {
    const firebase = Object.assign(new Error('token abc.def'), { code: 'auth/argument-error' });
    expect(describeError(firebase)).toBe('Error (auth/argument-error)');
    expect(describeError(new TypeError('user ana@example.com'))).toBe('TypeError');
    expect(describeError('ana@example.com')).toBe('unknown error');
  });
});

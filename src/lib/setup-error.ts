/**
 * A server configuration problem (missing or malformed env, the emulator outside tests). Its message is the app's
 * own pt-BR text and never quotes a secret, a token or user data, so logs may print it in full.
 */
export class SetupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SetupError';
  }
}

/**
 * What a log may say about an unexpected error: the full message of a SetupError; otherwise only the name and a
 * string `code` (Firebase and database messages can quote a token or the user's data).
 */
export function describeError(error: unknown): string {
  if (error instanceof SetupError) return `${error.name}: ${error.message}`;
  if (!(error instanceof Error)) return 'unknown error';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? `${error.name} (${code})` : error.name;
}

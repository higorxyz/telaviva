import { z } from 'zod';

const envSchema = z.object({
  TMDB_READ_TOKEN: z.string().min(1, 'TMDB_READ_TOKEN é obrigatório'),
  TMDB_API_BASE_URL: z.string().url().default('https://api.themoviedb.org/3'),
  SITE_URL: z.string().url().default('https://telaviva.vercel.app'),
  /** Upper bound for one TMDb request; only the local E2E server raises it (see playwright.config.ts). */
  TMDB_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(8000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse({
    TMDB_READ_TOKEN: source.TMDB_READ_TOKEN,
    TMDB_API_BASE_URL: source.TMDB_API_BASE_URL || undefined,
    SITE_URL: source.NEXT_PUBLIC_SITE_URL || undefined,
    TMDB_TIMEOUT_MS: source.TMDB_TIMEOUT_MS || undefined,
  });
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Variáveis de ambiente inválidas: ${details}`);
  }
  return result.data;
}

export type ServerAuthEnv = {
  firebase: { projectId: string; clientEmail: string; privateKey: string } | null;
  databaseUrl: string | null;
  databaseDriver: 'neon' | 'pglite';
  pgliteDir: string | null;
};

/** Vercel stores the key with literal backslash-n sequences; quotes survive if the user pasted them. */
function unescapeKey(raw: string | undefined): string | undefined {
  return raw
    ?.trim()
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n')
    .trim();
}

/**
 * Server-only: reads secrets, never import it from client code (use auth-config.ts there).
 * Accounts are optional: every variable may be missing, which turns sign-in off.
 * A partial Firebase credential counts as missing so the site never half-enables login.
 */
export function parseServerAuthEnv(source: Record<string, string | undefined>): ServerAuthEnv {
  const databaseDriver = source.DATABASE_DRIVER === 'pglite' ? 'pglite' : 'neon';
  if (databaseDriver === 'pglite' && source.VERCEL) {
    throw new Error('DATABASE_DRIVER=pglite não pode ser usado na Vercel (o PGlite é só para testes).');
  }
  const projectId = source.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = source.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = unescapeKey(source.FIREBASE_PRIVATE_KEY);
  return {
    firebase:
      projectId && clientEmail && privateKey
        ? { projectId, clientEmail, privateKey: `${privateKey}\n` }
        : null,
    databaseUrl: source.DATABASE_URL?.trim() || null,
    databaseDriver,
    pgliteDir: source.PGLITE_DIR?.trim() || null,
  };
}

/** Firebase credential plus a database (Neon URL, or PGlite in tests). */
export function serverAuthConfigured(parsed: ServerAuthEnv): boolean {
  return parsed.firebase !== null && (parsed.databaseUrl !== null || parsed.databaseDriver === 'pglite');
}

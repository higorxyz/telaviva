import { isLocalHostname } from './auth-config';
import { describeKeyProblem, normalizePrivateKey } from './private-key';

/**
 * Which environment variables a deploy target still needs, by name only: nothing here ever returns, prints or embeds a
 * value (not even a fragment of one), so the result is safe to show in a terminal, a CI log or an issue.
 *
 * Variables the app reads (`process.env` in src/, scripts/, next.config.ts and the E2E config) and how each target
 * treats them:
 *
 * | Variable                                   | local     | preview   | production |
 * | ------------------------------------------ | --------- | --------- | ---------- |
 * | `TMDB_READ_TOKEN`                          | required  | required  | required   |
 * | `NEXT_PUBLIC_SITE_URL`                     | optional  | optional  | required   |
 * | the accounts group (`ACCOUNT_VARIABLES`)   | all/none  | all/none  | required   |
 * | `TMDB_API_BASE_URL`, `TMDB_TIMEOUT_MS`     | optional  | optional  | optional   |
 * | `NEXT_PUBLIC_SW_DISABLED` (kill switch)    | optional  | optional  | optional   |
 * | `*_AUTH_EMULATOR_HOST`, `DATABASE_DRIVER`  | optional  | forbidden | forbidden  |
 *
 * - **Accounts are optional** outside production: without them the site runs for visitors only. But a partial set
 *   silently turns sign-in off (env-schema.ts and auth-config.ts each need their whole half), so once any account
 *   variable is set, the rest count as missing. Production is the launch: sign-in must work there.
 * - Locally, `DATABASE_DRIVER=pglite` stands in for `DATABASE_URL` (tests and E2E use PGlite).
 * - The Auth emulator and PGlite only exist on the developer's machine; the server refuses them on Vercel.
 * - On Vercel the auth domain is the site's own host (the `/__/auth` proxy in next.config.ts), never `localhost`, and in
 *   production it must equal the `NEXT_PUBLIC_SITE_URL` host: the CSP's `frame-src 'self'` relies on it.
 *
 * Not checked, because the platform, the build or a script sets them: `CI`, `VERCEL`, `VERCEL_GIT_COMMIT_SHA`,
 * `NODE_ENV`, `NEXT_DIST_DIR`, `NEXT_TSCONFIG_PATH`, `E2E_BASE_URL`, `MIGRATE_CONFIRM`, `PGLITE_DIR`.
 */

export type EnvTarget = 'local' | 'preview' | 'production';

export const ENV_TARGETS: readonly EnvTarget[] = ['local', 'preview', 'production'];

export type EnvCheck = { missing: string[]; invalid: string[] };

type Source = Record<string, string | undefined>;

/** Sign-in needs every one of these: the public Firebase config, the service account and the database. */
export const ACCOUNT_VARIABLES: readonly string[] = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'DATABASE_URL',
];

/** Only the developer's machine may use these (src/server/auth/admin.ts and env-schema.ts refuse them on Vercel). */
const LOCAL_ONLY = [
  'FIREBASE_AUTH_EMULATOR_HOST',
  'NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
] as const;

const read = (source: Source, name: string): string | undefined =>
  source[name]?.trim() || undefined;

function isUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** The host part of an auth domain (`host[:port]`, with or without a scheme), or undefined when unparseable. */
function hostOf(value: string): URL | undefined {
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return undefined;
  }
}

function missingNames(source: Source, target: EnvTarget): string[] {
  const has = (name: string) => read(source, name) !== undefined;
  const pglite = target === 'local' && read(source, 'DATABASE_DRIVER') === 'pglite';
  const accountsWanted = target === 'production' || ACCOUNT_VARIABLES.some(has);
  const required = [
    'TMDB_READ_TOKEN',
    ...(target === 'production' ? ['NEXT_PUBLIC_SITE_URL'] : []),
    ...(accountsWanted
      ? ACCOUNT_VARIABLES.filter((name) => !(name === 'DATABASE_URL' && pglite))
      : []),
  ];
  return required.filter((name) => !has(name));
}

function invalidNames(source: Source, target: EnvTarget): string[] {
  const invalid = new Set<string>();
  const onVercel = target !== 'local';

  const siteUrl = read(source, 'NEXT_PUBLIC_SITE_URL');
  if (siteUrl && !isUrl(siteUrl)) invalid.add('NEXT_PUBLIC_SITE_URL');

  const authDomain = read(source, 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (authDomain && onVercel) {
    const host = hostOf(authDomain);
    if (!host || isLocalHostname(host.hostname)) invalid.add('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
    if (
      target === 'production' &&
      host &&
      siteUrl &&
      isUrl(siteUrl) &&
      host.host !== new URL(siteUrl).host
    ) {
      invalid.add('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
    }
  }

  // With the emulator, firebase-admin never parses the key (src/server/auth/admin.ts), so a placeholder is fine.
  const emulated = !onVercel && read(source, 'FIREBASE_AUTH_EMULATOR_HOST');
  const rawKey = read(source, 'FIREBASE_PRIVATE_KEY');
  if (rawKey && !emulated && describeKeyProblem(normalizePrivateKey(rawKey)) !== '') {
    invalid.add('FIREBASE_PRIVATE_KEY');
  }

  if (onVercel) {
    for (const name of LOCAL_ONLY) if (read(source, name)) invalid.add(name);
    if (read(source, 'DATABASE_DRIVER') === 'pglite') invalid.add('DATABASE_DRIVER');
  }

  const tmdbBase = read(source, 'TMDB_API_BASE_URL');
  if (tmdbBase && !isUrl(tmdbBase)) invalid.add('TMDB_API_BASE_URL');
  const timeout = read(source, 'TMDB_TIMEOUT_MS');
  // The same bounds as env-schema.ts.
  if (
    timeout &&
    !(/^\d+$/.test(timeout) && Number(timeout) >= 1000 && Number(timeout) <= 120_000)
  ) {
    invalid.add('TMDB_TIMEOUT_MS');
  }
  return [...invalid];
}

export function checkEnv(source: Source, target: EnvTarget): EnvCheck {
  return { missing: missingNames(source, target), invalid: invalidNames(source, target) };
}

/** What a valid value looks like, for the report. Static text: never derived from what was configured. */
const HINTS: Record<string, string> = {
  NEXT_PUBLIC_SITE_URL: 'precisa ser uma URL completa, com https://',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    'na Vercel, o host do próprio site, sem https:// (em produção, o mesmo de NEXT_PUBLIC_SITE_URL)',
  FIREBASE_PRIVATE_KEY:
    'o private_key do JSON da conta de serviço, com as linhas BEGIN/END PRIVATE KEY',
  FIREBASE_AUTH_EMULATOR_HOST: 'o emulador é só para a máquina local',
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: 'o emulador é só para a máquina local',
  DATABASE_DRIVER: 'o PGlite é só para testes locais',
  TMDB_API_BASE_URL: 'precisa ser uma URL completa',
  TMDB_TIMEOUT_MS: 'milissegundos, entre 1000 e 120000',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** The terminal report: names, a static hint per invalid variable and a summary. */
export function formatEnvReport({ missing, invalid }: EnvCheck, target: EnvTarget): string {
  const lines = [`Variáveis de ambiente do TelaViva (alvo: ${target})`];
  if (missing.length > 0) lines.push('', 'Ausentes:', ...missing.map((name) => `  - ${name}`));
  if (invalid.length > 0) {
    lines.push(
      '',
      'Inválidas:',
      ...invalid.map((name) => `  - ${name}${HINTS[name] ? ` (${HINTS[name]})` : ''}`),
    );
  }
  lines.push('');
  if (missing.length === 0 && invalid.length === 0) {
    lines.push(`Resumo: nada faltando para ${target}.`);
  } else {
    const counts = `${plural(missing.length, 'ausente', 'ausentes')}, ${plural(invalid.length, 'inválida', 'inválidas')}`;
    lines.push(`Resumo: ${counts}. Veja docs/setup/configuracao.md.`);
  }
  return lines.join('\n');
}

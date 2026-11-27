// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_VARIABLES, checkEnv, formatEnvReport } from './check-env';

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

/** A production-ready environment; every value is distinctive so a leak in the output is easy to spot. */
const production: Record<string, string> = {
  TMDB_READ_TOKEN: 'segredo-tmdb-123',
  NEXT_PUBLIC_SITE_URL: 'https://telaviva.vercel.app',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'chave-publica-456',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'projeto-789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000:web:abc',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'telaviva.vercel.app',
  FIREBASE_PROJECT_ID: 'projeto-789',
  FIREBASE_CLIENT_EMAIL: 'svc@projeto-789.iam.gserviceaccount.com',
  // Literal backslash-n, as Vercel stores it.
  FIREBASE_PRIVATE_KEY: pem.trimEnd().replace(/\n/g, '\\n'),
  DATABASE_URL: 'postgres://usuario:senha-super-secreta@host.neon.tech/db',
};

const without = (source: Record<string, string>, ...names: string[]) =>
  Object.fromEntries(Object.entries(source).filter(([name]) => !names.includes(name)));

describe('checkEnv', () => {
  it('não aponta nada num ambiente de produção completo', () => {
    expect(checkEnv(production, 'production')).toEqual({ missing: [], invalid: [] });
  });

  it('aponta cada variável ausente por nome em produção', () => {
    expect(checkEnv({}, 'production').missing).toEqual([
      'TMDB_READ_TOKEN',
      'NEXT_PUBLIC_SITE_URL',
      ...ACCOUNT_VARIABLES,
    ]);
    for (const name of ['TMDB_READ_TOKEN', 'DATABASE_URL', 'FIREBASE_PRIVATE_KEY']) {
      expect(checkEnv(without(production, name), 'production').missing).toEqual([name]);
    }
  });

  it('exige só o token do TMDb localmente e no preview (o login desliga sem as contas)', () => {
    expect(checkEnv({}, 'local')).toEqual({ missing: ['TMDB_READ_TOKEN'], invalid: [] });
    expect(checkEnv({ TMDB_READ_TOKEN: 'x' }, 'preview')).toEqual({ missing: [], invalid: [] });
  });

  it('trata valor vazio ou só com espaços como ausente', () => {
    expect(checkEnv({ TMDB_READ_TOKEN: '  ' }, 'local').missing).toEqual(['TMDB_READ_TOKEN']);
  });

  it('com parte das contas configurada, aponta o resto (senão o login fica desligado sem aviso)', () => {
    const partial = { TMDB_READ_TOKEN: 'x', NEXT_PUBLIC_FIREBASE_API_KEY: 'k' };
    expect(checkEnv(partial, 'local').missing).toEqual(
      ACCOUNT_VARIABLES.filter((name) => name !== 'NEXT_PUBLIC_FIREBASE_API_KEY'),
    );
  });

  it('localmente, o PGlite dispensa DATABASE_URL', () => {
    const local = { ...without(production, 'DATABASE_URL'), DATABASE_DRIVER: 'pglite' };
    expect(checkEnv(local, 'local').missing).toEqual([]);
    expect(checkEnv(local, 'production').missing).toEqual(['DATABASE_URL']);
  });

  it('chave privada sem -----BEGIN é inválida', () => {
    const source = { ...production, FIREBASE_PRIVATE_KEY: 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC' };
    expect(checkEnv(source, 'production')).toEqual({
      missing: [],
      invalid: ['FIREBASE_PRIVATE_KEY'],
    });
  });

  it('aceita a chave colada como o JSON inteiro da conta de serviço', () => {
    const source = { ...production, FIREBASE_PRIVATE_KEY: JSON.stringify({ private_key: pem }) };
    expect(checkEnv(source, 'production').invalid).toEqual([]);
  });

  it('NEXT_PUBLIC_SITE_URL que não é URL é inválido', () => {
    expect(
      checkEnv({ TMDB_READ_TOKEN: 'x', NEXT_PUBLIC_SITE_URL: 'telaviva' }, 'local').invalid,
    ).toEqual(['NEXT_PUBLIC_SITE_URL']);
  });

  it('authDomain com localhost só vale localmente', () => {
    const source = { ...production, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost:3000' };
    expect(checkEnv(source, 'local').invalid).toEqual([]);
    expect(checkEnv(source, 'preview').invalid).toEqual(['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']);
    expect(checkEnv(source, 'production').invalid).toEqual(['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']);
  });

  it('em produção, o authDomain precisa ser o host do site (a CSP e o proxy /__/auth contam com isso)', () => {
    const source = {
      ...production,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'projeto-789.firebaseapp.com',
    };
    expect(checkEnv(source, 'production').invalid).toEqual(['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']);
  });

  it('emulador e PGlite fora da máquina local são inválidos', () => {
    const source = {
      ...production,
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
      DATABASE_DRIVER: 'pglite',
    };
    expect(checkEnv(source, 'local').invalid).toEqual([]);
    expect(checkEnv(source, 'preview').invalid).toEqual([
      'FIREBASE_AUTH_EMULATOR_HOST',
      'NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST',
      'DATABASE_DRIVER',
    ]);
  });

  it('valida os opcionais do TMDb quando presentes', () => {
    const source = { TMDB_READ_TOKEN: 'x', TMDB_API_BASE_URL: 'api', TMDB_TIMEOUT_MS: '10' };
    expect(checkEnv(source, 'local').invalid).toEqual(['TMDB_API_BASE_URL', 'TMDB_TIMEOUT_MS']);
  });
});

describe('formatEnvReport', () => {
  const values = Object.values(production);

  it('nenhuma saída contém um valor', () => {
    const broken = {
      ...without(production, 'DATABASE_URL'),
      FIREBASE_PRIVATE_KEY: 'chave-quebrada-sem-begin',
      NEXT_PUBLIC_SITE_URL: 'nao-e-url',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'localhost:3000',
    };
    for (const target of ['local', 'preview', 'production'] as const) {
      const result = checkEnv(broken, target);
      const report = formatEnvReport(result, target);
      const everything = JSON.stringify(result) + report;
      for (const value of [...values, ...Object.values(broken)]) {
        expect(everything).not.toContain(value);
      }
      // Not even a fragment of the key.
      expect(everything).not.toContain('PRIVATE KEY-----');
    }
  });

  it('lista nomes e um resumo', () => {
    const report = formatEnvReport(
      { missing: ['DATABASE_URL'], invalid: ['FIREBASE_PRIVATE_KEY'] },
      'production',
    );
    expect(report).toContain('DATABASE_URL');
    expect(report).toContain('FIREBASE_PRIVATE_KEY');
    expect(report).toMatch(/1 ausente.*1 inválida/);
  });

  it('diz quando está tudo certo', () => {
    expect(formatEnvReport({ missing: [], invalid: [] }, 'local')).toMatch(/nada faltando/i);
  });
});

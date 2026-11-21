import { describe, expect, it } from 'vitest';
import { parseEnv, parseServerAuthEnv, serverAuthConfigured } from './env-schema';

const full = {
  FIREBASE_PROJECT_ID: 'demo-telaviva',
  FIREBASE_CLIENT_EMAIL: 'svc@demo-telaviva.iam.gserviceaccount.com',
  // Literal backslash-n sequences, exactly as Vercel and the service-account JSON provide them.
  FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\ndef\\n-----END PRIVATE KEY-----\\n',
  DATABASE_URL: 'postgres://u:p@host/db',
};

describe('parseServerAuthEnv', () => {
  it('devolve tudo nulo sem nenhuma variável', () => {
    expect(parseServerAuthEnv({})).toEqual({
      firebase: null,
      databaseUrl: null,
      databaseDriver: 'neon',
      pgliteDir: null,
    });
    expect(serverAuthConfigured(parseServerAuthEnv({}))).toBe(false);
  });
  it('preenche firebase e banco com as variáveis completas', () => {
    const parsed = parseServerAuthEnv(full);
    expect(parsed.firebase).toMatchObject({
      projectId: 'demo-telaviva',
      clientEmail: 'svc@demo-telaviva.iam.gserviceaccount.com',
    });
    expect(parsed.databaseUrl).toBe('postgres://u:p@host/db');
    expect(parsed.databaseDriver).toBe('neon');
    expect(serverAuthConfigured(parsed)).toBe(true);
  });
  it('converte a sequência literal barra-n da chave num PEM com quebras de linha reais', () => {
    expect(full.FIREBASE_PRIVATE_KEY).not.toContain('\n');
    const key = parseServerAuthEnv(full).firebase?.privateKey;
    // The body is re-wrapped at 64 characters (see private-key.ts), so the two fake lines join into one.
    expect(key).toBe('-----BEGIN PRIVATE KEY-----\nabcdef\n-----END PRIVATE KEY-----\n');
  });
  it('aceita a chave entre aspas, como a Vercel guarda quando coladas', () => {
    const quoted = { ...full, FIREBASE_PRIVATE_KEY: `"${full.FIREBASE_PRIVATE_KEY}"` };
    expect(parseServerAuthEnv(quoted).firebase?.privateKey).toContain('BEGIN PRIVATE KEY-----\nabcdef');
  });
  it('trata credencial do Firebase incompleta como ausente', () => {
    expect(parseServerAuthEnv({ ...full, FIREBASE_PRIVATE_KEY: undefined }).firebase).toBeNull();
  });
  it('usa pglite só com DATABASE_DRIVER=pglite e lê PGLITE_DIR', () => {
    const parsed = parseServerAuthEnv({ DATABASE_DRIVER: 'pglite', PGLITE_DIR: '.e2e/pg' });
    expect(parsed.databaseDriver).toBe('pglite');
    expect(parsed.pgliteDir).toBe('.e2e/pg');
    expect(parseServerAuthEnv({ DATABASE_DRIVER: 'outro' }).databaseDriver).toBe('neon');
  });
  it('proíbe pglite quando VERCEL está definido', () => {
    expect(() => parseServerAuthEnv({ DATABASE_DRIVER: 'pglite', VERCEL: '1' })).toThrow(/pglite/);
  });
  it('considera o banco pglite como banco presente', () => {
    const parsed = parseServerAuthEnv({ ...full, DATABASE_URL: undefined, DATABASE_DRIVER: 'pglite' });
    expect(serverAuthConfigured(parsed)).toBe(true);
  });
});

describe('parseEnv com as variáveis novas', () => {
  it('mantém TMDB_READ_TOKEN obrigatório e ignora as variáveis de conta', () => {
    expect(() => parseEnv(full)).toThrow(/TMDB_READ_TOKEN/);
    expect(parseEnv({ ...full, TMDB_READ_TOKEN: 'tok' }).TMDB_READ_TOKEN).toBe('tok');
  });
});

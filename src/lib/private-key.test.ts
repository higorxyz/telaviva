// @vitest-environment node
import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { describeKeyProblem, normalizePrivateKey } from './private-key';

const pem = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const literal = pem.trimEnd().replace(/\n/g, '\\n');

/** The key Node (and firebase-admin, which uses the same PEM rules) can load. */
const loads = (key: string | undefined) => {
  if (!key) return false;
  try {
    createPrivateKey(key);
    return true;
  } catch {
    return false;
  }
};

describe('normalizePrivateKey', () => {
  it.each([
    ['real newlines', pem],
    ['literal \\n (how Vercel shows a pasted .env line)', literal],
    ['quoted literal \\n', `"${literal}\\n"`],
    ['quoted with a trailing comma (copied from the JSON file)', `"${literal}\\n",`],
    ['double-escaped \\\\n', literal.replace(/\\n/g, '\\\\n')],
    ['CRLF newlines', pem.replace(/\n/g, '\r\n')],
    ['one line with spaces where the line breaks were', pem.trimEnd().replace(/\n/g, ' ')],
    ['one line with no separators at all', pem.trimEnd().replace(/\n/g, '')],
    ['the whole service-account JSON file', JSON.stringify({ type: 'service_account', private_key: pem })],
  ])('accepts %s', (_name, raw) => {
    const key = normalizePrivateKey(raw);
    expect(loads(key)).toBe(true);
    expect(key?.endsWith('-----END PRIVATE KEY-----\n')).toBe(true);
  });

  it('returns undefined for a missing or blank value', () => {
    expect(normalizePrivateKey(undefined)).toBeUndefined();
    expect(normalizePrivateKey('   ')).toBeUndefined();
  });

  it('leaves a value without the PEM markers for the parser to reject', () => {
    const body = pem
      .split('\n')
      .filter((line) => line && !line.startsWith('-----'))
      .join('\n');
    expect(loads(normalizePrivateKey(body))).toBe(false);
  });
});

describe('describeKeyProblem', () => {
  it('names a missing header or footer without quoting the key', () => {
    const body = pem.split('\n').slice(1, -2).join('\n');
    const hint = describeKeyProblem(normalizePrivateKey(body));
    expect(hint).toContain('-----BEGIN PRIVATE KEY-----');
    expect(hint).not.toContain(body.slice(0, 20));
  });

  it('flags a key that is too short to be complete', () => {
    const cut = `-----BEGIN PRIVATE KEY-----\n${pem.split('\n')[1]}\n-----END PRIVATE KEY-----\n`;
    expect(describeKeyProblem(cut)).toMatch(/incompleta/);
  });

  it('says nothing about a well-formed key', () => {
    expect(describeKeyProblem(normalizePrivateKey(literal))).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return-to';

const FALLBACK = '/minha-lista';

describe('safeReturnTo', () => {
  it.each([
    ['/conta', '/conta'],
    ['/filme/123-duna', '/filme/123-duna'],
    ['/buscar?q=duna&tipo=filme', '/buscar?q=duna&tipo=filme'],
    ['/serie/1-x#temporadas', '/serie/1-x#temporadas'],
    ['/', '/'],
  ])('keeps the internal path %s', (raw, expected) => {
    expect(safeReturnTo(raw, FALLBACK)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'conta',
    'https://mal.com',
    'https://mal.com/conta',
    'http:/mal.com',
    '//mal.com',
    '//mal.com/conta',
    '/\\mal.com',
    '\\\\mal.com',
    '/\t/mal.com',
    '/\n/mal.com',
    ' //mal.com',
    'javascript:alert(1)',
    'data:text/html,oi',
    // Dot segments the URL parser collapses into a protocol-relative `//host` after the raw checks passed.
    '/.//evil.com',
    '/..//evil.com',
    '/%2e//evil.com',
    '/%2e%2e//evil.com',
    '/x/..//evil.com',
    '/./\\evil.com',
    // Mixed encodings and separators of the same trick.
    '/%2E%2e//evil.com',
    '/.%2e//evil.com',
    '/x/%2e%2E/\\evil.com',
    '/./\t/evil.com',
  ])('falls back for %j', (raw) => {
    expect(safeReturnTo(raw, FALLBACK)).toBe(FALLBACK);
  });

  it('never sends the user back to the sign-in page itself', () => {
    expect(safeReturnTo('/entrar', FALLBACK)).toBe(FALLBACK);
    expect(safeReturnTo('/entrar?voltar=/conta', FALLBACK)).toBe(FALLBACK);
    expect(safeReturnTo('/entrar/', FALLBACK)).toBe(FALLBACK);
    expect(safeReturnTo('/entrarx', FALLBACK)).toBe('/entrarx');
  });
});

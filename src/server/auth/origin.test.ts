// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { expectedOrigin, isSameOrigin, isSecureRequest } from './origin';

const req = (url: string, headers: Record<string, string> = {}, method = 'POST') =>
  new Request(url, { method, headers });

describe('expectedOrigin', () => {
  it('uses Host and the URL protocol on a local http server', () => {
    expect(expectedOrigin(req('http://localhost:3000/api/x', { host: 'localhost:3000' }))).toBe(
      'http://localhost:3000',
    );
  });

  it('prefers x-forwarded-host and x-forwarded-proto (first hop) behind a proxy', () => {
    const r = req('http://internal:8080/api/x', {
      host: 'internal:8080',
      'x-forwarded-host': 'telaviva.vercel.app, other.example',
      'x-forwarded-proto': 'https, http',
    });
    expect(expectedOrigin(r)).toBe('https://telaviva.vercel.app');
  });

  it('drops the default port so it matches what browsers send', () => {
    const r = req('https://telaviva.vercel.app/api/x', {
      'x-forwarded-host': 'telaviva.vercel.app:443',
      'x-forwarded-proto': 'https',
    });
    expect(expectedOrigin(r)).toBe('https://telaviva.vercel.app');
  });

  it('falls back to the request URL when no host header is present', () => {
    expect(expectedOrigin(req('http://127.0.0.1:3100/api/x'))).toBe('http://127.0.0.1:3100');
  });

  it('is null for a protocol other than http or https', () => {
    expect(
      expectedOrigin(req('http://localhost/api/x', { 'x-forwarded-proto': 'javascript' })),
    ).toBeNull();
  });
});

describe('isSameOrigin', () => {
  it('accepts the localhost http case', () => {
    expect(
      isSameOrigin(
        req('http://localhost:3000/api/x', {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        }),
      ),
    ).toBe(true);
  });

  it('accepts the Vercel https case', () => {
    const r = req('http://10.0.0.1/api/x', {
      host: '10.0.0.1',
      'x-forwarded-host': 'telaviva.vercel.app',
      'x-forwarded-proto': 'https',
      origin: 'https://telaviva.vercel.app',
    });
    expect(isSameOrigin(r)).toBe(true);
  });

  it('rejects a missing Origin', () => {
    expect(isSameOrigin(req('http://localhost:3000/api/x', { host: 'localhost:3000' }))).toBe(
      false,
    );
  });

  it('rejects a different host', () => {
    expect(
      isSameOrigin(req('https://telaviva.vercel.app/api/x', { origin: 'https://evil.example' })),
    ).toBe(false);
  });

  it('rejects a lookalike host, another scheme, another port and the opaque "null" origin', () => {
    const at = (origin: string) =>
      isSameOrigin(
        req('https://telaviva.vercel.app/api/x', { host: 'telaviva.vercel.app', origin }),
      );
    expect(at('https://telaviva.vercel.app.evil.example')).toBe(false);
    expect(at('http://telaviva.vercel.app')).toBe(false);
    expect(at('https://telaviva.vercel.app:8443')).toBe(false);
    expect(at('null')).toBe(false);
  });
});

describe('isSecureRequest', () => {
  it('is false only for localhost or 127.0.0.1 over http', () => {
    expect(isSecureRequest(req('http://localhost:3000/x', { host: 'localhost:3000' }))).toBe(false);
    expect(isSecureRequest(req('http://127.0.0.1:3100/x', { host: '127.0.0.1:3100' }))).toBe(false);
  });

  it('is true over https, and for any other host even over http', () => {
    expect(
      isSecureRequest(
        req('http://10.0.0.1/x', {
          'x-forwarded-host': 'telaviva.vercel.app',
          'x-forwarded-proto': 'https',
        }),
      ),
    ).toBe(true);
    expect(isSecureRequest(req('http://example.test/x', { host: 'example.test' }))).toBe(true);
    expect(isSecureRequest(req('https://localhost/x', { host: 'localhost' }))).toBe(true);
  });
});

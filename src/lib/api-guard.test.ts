import { describe, expect, it } from 'vitest';
import { clientIp, createRateLimiter, limitByIp, MAX_BODY_BYTES, readJsonBody } from './api-guard';

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/x', { method: 'POST', body, headers });

describe('createRateLimiter', () => {
  it('lets `limit` requests through per window, then answers with the seconds left', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect([0, 1, 2].map(() => limiter.check('a', 1_000).ok)).toEqual([true, true, true]);
    expect(limiter.check('a', 31_000)).toEqual({ ok: false, retryAfterSeconds: 30 });
    // Other keys have their own budget, and a new window starts fresh.
    expect(limiter.check('b', 31_000).ok).toBe(true);
    expect(limiter.check('a', 61_000).ok).toBe(true);
  });

  it('never holds more than maxKeys entries (expired ones go first)', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, maxKeys: 2 });
    limiter.check('a', 0);
    limiter.check('b', 0);
    limiter.check('c', 5_000);
    expect(limiter.size()).toBeLessThanOrEqual(2);
    limiter.check('d', 5_000);
    limiter.check('e', 5_000);
    expect(limiter.size()).toBeLessThanOrEqual(2);
  });
});

describe('clientIp', () => {
  it('reads the first x-forwarded-for hop, trimmed', () => {
    const request = new Request('http://localhost', { headers: { 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1' } });
    expect(clientIp(request)).toBe('203.0.113.7');
  });

  it('is null without the header', () => {
    expect(clientIp(new Request('http://localhost'))).toBeNull();
  });
});

describe('limitByIp', () => {
  it('answers 429 with Retry-After once an IP is over the limit, and never limits a request without an IP', async () => {
    const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
    const from = (ip?: string) =>
      new Request('http://localhost', { headers: ip ? { 'x-forwarded-for': ip } : {} });
    for (let i = 0; i < 120; i++) expect(limitByIp(from('198.51.100.1'), limiter)).toBeNull();
    const blocked = limitByIp(from('198.51.100.1'), limiter);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await blocked?.json()).toEqual({ error: 'Muitas requisições. Tente de novo em instantes.' });
    expect(limitByIp(from('198.51.100.2'), limiter)).toBeNull();
    for (let i = 0; i < 150; i++) expect(limitByIp(from(), limiter)).toBeNull();
  });

  it.each(['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1', '[::1]'])('never limits loopback %s', (ip) => {
    const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
    const request = new Request('http://localhost', { headers: { 'x-forwarded-for': ip } });
    for (let i = 0; i < 300; i++) expect(limitByIp(request, limiter)).toBeNull();
    expect(limiter.size()).toBe(0);
  });

  it('limits a public IP at the 121st request within a minute', () => {
    const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });
    const request = new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.9' } });
    for (let i = 0; i < 120; i++) expect(limitByIp(request, limiter)).toBeNull();
    expect(limitByIp(request, limiter)?.status).toBe(429);
  });
});

describe('readJsonBody', () => {
  it('parses a small JSON body', async () => {
    expect(await readJsonBody(post('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } });
  });

  it('is 400 for a body that is not JSON', async () => {
    expect(await readJsonBody(post('{oops'))).toEqual({ ok: false, status: 400 });
  });

  it('is 413 when content-length announces more than 64 KB, before reading anything', async () => {
    const request = post('{}', { 'content-length': String(MAX_BODY_BYTES + 1) });
    expect(await readJsonBody(request)).toEqual({ ok: false, status: 413 });
  });

  it('is 413 when the body itself is over 64 KB, whatever the header says', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES) });
    expect(await readJsonBody(post(big))).toEqual({ ok: false, status: 413 });
    expect(await readJsonBody(post(big, { 'content-length': '10' }))).toEqual({ ok: false, status: 413 });
  });

  it('accepts a body of exactly 64 KB', async () => {
    const exact = JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES - 10) });
    expect(new TextEncoder().encode(exact).length).toBe(MAX_BODY_BYTES);
    expect((await readJsonBody(post(exact))).ok).toBe(true);
  });
});

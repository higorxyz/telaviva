// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('sharp', () => ({
  default: () => ({ jpeg: () => ({ toBuffer: () => Promise.reject(new Error('sharp broke')) }) }),
}));

const { brandJpeg, DEGRADED_CACHE, FULL_CACHE, shareImage } = await import('./og-route');

describe('share images never throw', () => {
  it('brandJpeg falls back to the PNG card with the short cache when sharp fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await brandJpeg(FULL_CACHE);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe(DEGRADED_CACHE);
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it('shareImage still answers for an invalid slug when sharp fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await shareImage('abc', 'filme');
    expect(res.headers.get('content-type')).toBe('image/png');
    spy.mockRestore();
  });
});

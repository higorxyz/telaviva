import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import './zod-jitless';

describe('zod-jitless', () => {
  it('turns off the eval-based fast path in the browser, so the CSP sees no eval probe', () => {
    expect(z.config().jitless).toBe(true);
    expect(z.object({ a: z.number() }).parse({ a: 1 })).toEqual({ a: 1 });
  });
});

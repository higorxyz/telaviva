// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { describeTarget } from './target';

describe('describeTarget', () => {
  it('shows only the host for Neon, never the credentials', () => {
    const out = describeTarget('neon', 'postgresql://user:s3cret@ep-x.neon.tech/db?sslmode=require', null);
    expect(out).toBe('Neon (ep-x.neon.tech)');
    expect(out).not.toContain('s3cret');
    expect(out).not.toContain('user');
  });
  it('shows the directory for PGlite', () => {
    expect(describeTarget('pglite', null, '.pg-e2e')).toBe('PGlite (.pg-e2e)');
  });
  it('does not leak an unparsable URL', () => {
    expect(describeTarget('neon', 'not a url s3cret', null)).not.toContain('s3cret');
  });
});

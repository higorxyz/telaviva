import { describe, expect, it } from 'vitest';
import { truncateSummary } from './summary';

describe('truncateSummary', () => {
  it('mantém textos curtos', () => {
    expect(truncateSummary('  Uma  frase curta. ')).toBe('Uma frase curta.');
  });

  it('corta em limite de palavra com reticências, até 155 caracteres', () => {
    const out = truncateSummary('palavra '.repeat(40));
    expect(out.length).toBeLessThanOrEqual(155);
    expect(out.endsWith('palavra…')).toBe(true);
  });
});

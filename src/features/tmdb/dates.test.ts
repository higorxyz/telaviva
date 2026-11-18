import { describe, expect, it } from 'vitest';
import { saoPauloIsoDate } from './dates';

describe('saoPauloIsoDate', () => {
  // 2026-11-18T01:30Z is still 2026-11-17 22:30 in São Paulo (UTC-3).
  const now = Date.parse('2026-11-18T01:30:00Z');

  it('usa a data de São Paulo como hoje', () => {
    expect(saoPauloIsoDate(0, now)).toBe('2026-11-17');
  });

  it('soma e subtrai dias no calendário', () => {
    expect(saoPauloIsoDate(-120, now)).toBe('2026-07-20');
    expect(saoPauloIsoDate(14, now)).toBe('2026-12-01');
    expect(saoPauloIsoDate(1, now)).toBe('2026-11-18');
    expect(saoPauloIsoDate(450, now)).toBe('2028-02-10');
  });

  it('usa Date.now por padrão', () => {
    expect(saoPauloIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { describe, expect, it } from 'vitest';
import { GRID_SIZES } from './GridSkeleton';
import { gridSizes } from './sizes';

describe('gridSizes', () => {
  it('states the real column width of the default poster grid at every breakpoint', () => {
    expect(GRID_SIZES).toBe(
      [
        '(min-width: 1600px) 176px',
        '(min-width: 1536px) calc((100vw - 192px) / 8)',
        '(min-width: 1280px) calc((100vw - 176px) / 7)',
        '(min-width: 1024px) calc((100vw - 160px) / 6)',
        '(min-width: 768px) calc((100vw - 112px) / 5)',
        '(min-width: 640px) calc((100vw - 96px) / 4)',
        'calc((100vw - 56px) / 3)',
      ].join(', '),
    );
  });

  it('caps the widest step at the container max width', () => {
    // 7 columns at 2xl: (1600 - 80 padding - 6 * 16 gaps) / 7 = 203.4px.
    expect(gridSizes([3, 4, 5, 6, 7, 7]).split(', ')[0]).toBe('(min-width: 1600px) 204px');
  });
});

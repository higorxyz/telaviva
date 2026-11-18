import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SeasonSummary } from '@/features/tmdb/types';
import { orderSeasons } from './seasons';
import { SeasonPicker } from './SeasonPicker';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const s = (seasonNumber: number): SeasonSummary => ({
  seasonNumber,
  name: `Season ${seasonNumber}`,
  episodeCount: 8,
  airDate: '2020-01-01',
  posterPath: null,
});

describe('SeasonPicker', () => {
  it('links por temporada com aria-current na atual e Especiais por último', () => {
    render(<SeasonPicker seasons={orderSeasons([s(0), s(1), s(2)])} current={2} baseHref="/serie/1399-got" />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Temporada 1', 'Temporada 2', 'Especiais']);
    expect(links[1]).toHaveAttribute('href', '/serie/1399-got?temporada=2');
    expect(links[1]).toHaveAttribute('aria-current', 'true');
    expect(links[0]).not.toHaveAttribute('aria-current');
  });

  it('select rotulado com a temporada atual selecionada', () => {
    render(<SeasonPicker seasons={orderSeasons([s(1), s(2)])} current={2} baseHref="/serie/1399-got" />);
    expect(screen.getByLabelText('Temporada')).toHaveValue('2');
  });
});

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LibraryStats } from './LibraryStats';

const stats = {
  moviesWatched: 12, seriesWatched: 3, seriesWatching: 2, episodesWatched: 47, wantCount: 5, averageScore: 7.5,
};

function figure(label: string) {
  const dt = screen.getByText(label);
  return within(dt.parentElement as HTMLElement);
}

describe('LibraryStats', () => {
  it('shows the six figures with their labels', () => {
    render(<LibraryStats stats={stats} />);
    expect(figure('Filmes assistidos').getByText('12')).toBeInTheDocument();
    expect(figure('Séries assistidas').getByText('3')).toBeInTheDocument();
    expect(figure('Assistindo agora').getByText('2')).toBeInTheDocument();
    expect(figure('Episódios vistos').getByText('47')).toBeInTheDocument();
    expect(figure('Quero ver').getByText('5')).toBeInTheDocument();
    expect(figure('Média das suas notas').getByText('7,5')).toBeInTheDocument();
  });

  it('shows a dash when there is no average', () => {
    render(<LibraryStats stats={{ ...stats, averageScore: null }} />);
    expect(figure('Média das suas notas').getByText('–')).toBeInTheDocument();
  });

  it('writes the average with one decimal and a comma', () => {
    render(<LibraryStats stats={{ ...stats, averageScore: 8 }} />);
    expect(figure('Média das suas notas').getByText('8,0')).toBeInTheDocument();
  });
});

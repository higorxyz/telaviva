import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WatchProviders as Providers } from '@/features/tmdb/types';
import { WatchProviders } from './WatchProviders';

const empty: Providers = { link: null, flatrate: [], free: [], ads: [], rent: [], buy: [] };
const netflix = { id: 8, name: 'Netflix', logoPath: '/n.jpg' };

describe('WatchProviders', () => {
  it('mostra só os grupos com provedores e o crédito do JustWatch', () => {
    render(<WatchProviders providers={{ ...empty, link: 'https://tmdb.test/watch', flatrate: [netflix] }} />);
    expect(screen.getByText('Streaming')).toBeInTheDocument();
    expect(screen.getByText('Netflix')).toBeInTheDocument();
    expect(screen.queryByText('Aluguel')).toBeNull();
    expect(screen.queryByText('Compra')).toBeNull();
    expect(screen.getByText('Dados de streaming fornecidos por JustWatch.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver opções no TMDb/ })).toHaveAttribute(
      'href',
      'https://tmdb.test/watch',
    );
  });

  it('mostra o aviso quando não há nenhum provedor', () => {
    render(<WatchProviders providers={empty} />);
    expect(screen.getByText('Ainda não disponível em streaming no Brasil.')).toBeInTheDocument();
    expect(screen.queryByText('Streaming')).toBeNull();
  });

  it('usa placeholder quando o provedor não tem logo', () => {
    render(<WatchProviders providers={{ ...empty, rent: [{ id: 1, name: 'Loja', logoPath: null }] }} />);
    expect(screen.getByText('Aluguel')).toBeInTheDocument();
    expect(screen.getByText('Loja')).toBeInTheDocument();
  });
});

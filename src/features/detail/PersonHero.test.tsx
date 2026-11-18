import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PersonPhoto } from './PersonHero';

describe('PersonPhoto', () => {
  it('usa o alt "Foto de {nome}" quando há foto', () => {
    render(<PersonPhoto person={{ name: 'Brad Pitt', profilePath: '/x.jpg' }} />);
    expect(screen.getByRole('img', { name: 'Foto de Brad Pitt' })).toBeInTheDocument();
  });

  it('mostra as iniciais quando não há foto', () => {
    render(<PersonPhoto person={{ name: 'Brad Pitt', profilePath: null }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('photo-placeholder')).toHaveTextContent('BP');
    expect(screen.getByText('Sem foto de Brad Pitt')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RatingRing } from './RatingRing';

describe('RatingRing', () => {
  it('renders a TMDb rating', () => {
    render(<RatingRing value={8} />);
    expect(screen.getByRole('img', { name: 'Nota 8,0 de 10' })).toBeInTheDocument();
    expect(screen.getByText('8,0')).toBeInTheDocument();
    expect(screen.getByRole('img').style.getPropertyValue('--pct')).toBe('80%');
  });

  it('renders no rating for 0', () => {
    render(<RatingRing value={0} />);
    expect(screen.getByRole('img', { name: 'Sem nota' })).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('renders no rating for null', () => {
    render(<RatingRing value={null} />);
    expect(screen.getByRole('img', { name: 'Sem nota' })).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('renders the personal tone', () => {
    render(<RatingRing value={7.66} tone="personal" />);
    expect(screen.getByRole('img', { name: 'Sua nota 7,7 de 10' })).toBeInTheDocument();
  });

  it('clamps values above 10', () => {
    render(<RatingRing value={12} />);
    expect(screen.getByRole('img', { name: 'Nota 10,0 de 10' })).toBeInTheDocument();
    expect(screen.getByRole('img').style.getPropertyValue('--pct')).toBe('100%');
  });
});

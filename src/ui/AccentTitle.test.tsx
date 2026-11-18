import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AccentTitle } from './AccentTitle';

afterEach(cleanup);

describe('AccentTitle', () => {
  it('emphasizes the accent from text', () => {
    render(<AccentTitle as="h1" text="A Odisseia" />);
    const h1 = screen.getByRole('heading', { level: 1, name: 'A Odisseia' });
    expect(within(h1).getByText('Odisseia').tagName).toBe('EM');
  });

  it('accepts explicit lead and accent', () => {
    render(<AccentTitle lead="Em" accent="cartaz" />);
    const h2 = screen.getByRole('heading', { level: 2, name: 'Em cartaz' });
    expect(within(h2).getByText('cartaz').tagName).toBe('EM');
  });
});

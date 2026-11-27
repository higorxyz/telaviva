import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClampedText } from './ClampedText';

function mockHeights(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

describe('ClampedText', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mostra o botão quando o texto transborda e alterna o estado', async () => {
    mockHeights(90, 60);
    const user = userEvent.setup();
    render(<ClampedText text="Sinopse média" />);
    const btn = await screen.findByRole('button', { name: 'Ler mais' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(screen.getByRole('button', { name: 'Mostrar menos' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('esconde o botão quando o texto cabe nas três linhas', () => {
    mockHeights(60, 60);
    render(<ClampedText text="Curta." />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Curta.')).toBeInTheDocument();
  });

  it('aceita um limite de linhas maior', () => {
    mockHeights(60, 60);
    render(<ClampedText text="Biografia" lines={8} />);
    expect(screen.getByText('Biografia')).toHaveClass('line-clamp-8');
  });
});

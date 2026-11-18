import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Video } from '@/features/tmdb/types';
import { HeroTrailer } from './HeroTrailer';

const video: Video = { key: 'abc123', site: 'YouTube', type: 'Trailer', official: true, language: 'pt', name: 'T' };

// jsdom has no modal dialog support; mimic open state and the close event.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

describe('HeroTrailer', () => {
  it('abre o trailer no diálogo e descarrega o iframe ao fechar', async () => {
    const user = userEvent.setup();
    render(<HeroTrailer video={video} title="Clube da Luta" />);
    expect(document.querySelector('iframe')).toBeNull();

    await user.click(screen.getByRole('button', { name: /Assistir trailer/ }));
    expect(document.querySelector('dialog')).toHaveAttribute('open');
    expect(document.querySelector('iframe')?.src).toContain('youtube-nocookie.com/embed/abc123');

    await user.click(screen.getByRole('button', { name: /Fechar/ }));
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
  });
});

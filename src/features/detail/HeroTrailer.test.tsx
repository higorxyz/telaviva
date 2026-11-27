import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity, type ReactNode } from 'react';
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

const youtubeFrames = () =>
  Array.from(document.querySelectorAll('iframe')).filter((f) => f.getAttribute('src')?.includes('youtube-nocookie.com'));

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

  it('abre de novo se o botão vier antes do evento close do Esc (thread principal ocupada)', async () => {
    const user = userEvent.setup();
    render(<HeroTrailer video={video} title="Clube da Luta" />);
    await user.click(screen.getByRole('button', { name: /Assistir trailer/ }));
    const dialog = document.querySelector('dialog')!;
    // Esc closes the element at once; its close event is a queued task that the next press can overtake.
    act(() => {
      dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      dialog.removeAttribute('open');
    });
    await user.click(screen.getByRole('button', { name: /Assistir trailer/ }));
    act(() => {
      dialog.dispatchEvent(new Event('close'));
    });
    expect(dialog).toHaveAttribute('open');
    expect(youtubeFrames()).toHaveLength(1);
  });

  it('fecha o diálogo e para o vídeo quando a rota fica oculta numa Activity', async () => {
    const user = userEvent.setup();
    const tree = (mode: 'visible' | 'hidden'): ReactNode => (
      <Activity mode={mode}>
        <HeroTrailer video={video} title="Clube da Luta" />
      </Activity>
    );
    const { rerender } = render(tree('visible'));
    await user.click(screen.getByRole('button', { name: /Assistir trailer/ }));
    expect(youtubeFrames()).toHaveLength(1);

    act(() => rerender(tree('hidden')));
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    expect(youtubeFrames()).toHaveLength(0);

    act(() => rerender(tree('visible')));
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    expect(youtubeFrames()).toHaveLength(0);
  });
});

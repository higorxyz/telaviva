import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { Video } from '@/features/tmdb/types';
import { Trailer } from './Trailer';

const video: Video = {
  key: 'SUXWAEX2jlg',
  site: 'YouTube',
  type: 'Trailer',
  official: true,
  language: 'pt',
  name: 'Trailer',
};

const cover = () => document.querySelector('img')!;
const thumb = (size: string) => `https://i.ytimg.com/vi/SUXWAEX2jlg/${size}.jpg`;
const youtubeFrames = () =>
  Array.from(document.querySelectorAll('iframe')).filter((f) => f.getAttribute('src')?.includes('youtube-nocookie.com'));

function loadWithWidth(img: HTMLImageElement, width: number) {
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: width });
  fireEvent.load(img);
}

describe('Trailer', () => {
  it('mostra só a capa e carrega o iframe depois do clique', async () => {
    const user = userEvent.setup();
    render(<Trailer video={video} title="Clube da Luta" />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(cover().src).toBe(thumb('maxresdefault'));

    await user.click(screen.getByRole('button', { name: 'Assistir trailer de Clube da Luta' }));

    const iframe = document.querySelector('iframe');
    expect(iframe?.src).toContain('youtube-nocookie.com/embed/SUXWAEX2jlg');
    expect(iframe?.src).toContain('autoplay=1');
    expect(iframe).toHaveAttribute('title', 'Trailer de Clube da Luta');
    expect(screen.queryByRole('button', { name: /Assistir trailer/ })).toBeNull();
  });

  it('cai de maxres para sd e hq quando a capa falha, e para no hq', () => {
    render(<Trailer video={video} title="Clube da Luta" />);
    fireEvent.error(cover());
    expect(cover().src).toBe(thumb('sddefault'));
    fireEvent.error(cover());
    expect(cover().src).toBe(thumb('hqdefault'));
    fireEvent.error(cover());
    expect(cover().src).toBe(thumb('hqdefault'));
  });

  it('troca o marcador cinza de 120px do YouTube pela próxima capa, mas mantém uma capa real', () => {
    render(<Trailer video={video} title="Clube da Luta" />);
    loadWithWidth(cover(), 120);
    expect(cover().src).toBe(thumb('sddefault'));
    loadWithWidth(cover(), 640);
    expect(cover().src).toBe(thumb('sddefault'));
  });

  it('toca direto com autoPlay (uso dentro do diálogo)', () => {
    render(<Trailer video={video} title="Clube da Luta" autoPlay />);
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('para o vídeo quando a rota fica oculta numa Activity e volta com a capa', async () => {
    const user = userEvent.setup();
    const tree = (mode: 'visible' | 'hidden'): ReactNode => (
      <Activity mode={mode}>
        <Trailer video={video} title="Clube da Luta" />
      </Activity>
    );
    const { rerender } = render(tree('visible'));
    await user.click(screen.getByRole('button', { name: 'Assistir trailer de Clube da Luta' }));
    expect(youtubeFrames()).toHaveLength(1);

    act(() => rerender(tree('hidden')));
    expect(youtubeFrames()).toHaveLength(0);

    act(() => rerender(tree('visible')));
    expect(youtubeFrames()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Assistir trailer de Clube da Luta' })).toBeInTheDocument();
  });
});

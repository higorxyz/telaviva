import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('Trailer', () => {
  it('mostra só a miniatura e carrega o iframe depois do clique', async () => {
    const user = userEvent.setup();
    render(<Trailer video={video} title="Clube da Luta" />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('img')?.src).toBe('https://i.ytimg.com/vi/SUXWAEX2jlg/hqdefault.jpg');

    await user.click(screen.getByRole('button', { name: 'Assistir trailer de Clube da Luta' }));

    const iframe = document.querySelector('iframe');
    expect(iframe?.src).toContain('youtube-nocookie.com/embed/SUXWAEX2jlg');
    expect(iframe?.src).toContain('autoplay=1');
    expect(iframe).toHaveAttribute('title', 'Trailer de Clube da Luta');
    expect(screen.queryByRole('button', { name: /Assistir trailer/ })).toBeNull();
  });

  it('toca direto com autoPlay (uso dentro do diálogo)', () => {
    render(<Trailer video={video} title="Clube da Luta" autoPlay />);
    expect(document.querySelector('iframe')).not.toBeNull();
  });
});

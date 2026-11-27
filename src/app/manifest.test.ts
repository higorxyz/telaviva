import { describe, expect, it } from 'vitest';
import { TOKENS } from '@/ui/tokens';
import manifest from './manifest';

describe('manifest', () => {
  const m = manifest();

  it('describes an installable pt-BR standalone app', () => {
    expect(m).toMatchObject({
      name: 'TelaViva',
      short_name: 'TelaViva',
      lang: 'pt-BR',
      start_url: '/',
      display: 'standalone',
      background_color: TOKENS.ink950,
      theme_color: TOKENS.ink950,
    });
  });

  it('lists the 192, 512 and maskable icons', () => {
    expect(m.icons?.map((i) => i.sizes)).toEqual(['192x192', '512x512', '512x512']);
    expect(m.icons?.map((i) => i.src)).toEqual(['/icons/192', '/icons/512', '/icons/maskable']);
    expect(m.icons?.[2].purpose).toBe('maskable');
  });
});

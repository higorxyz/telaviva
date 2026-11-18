import { describe, expect, it } from 'vitest';
import { backdropSrcSet, posterSrcSet, tmdbImage } from './images';

describe('tmdbImage', () => {
  it('monta a URL do CDN', () => {
    expect(tmdbImage('/a.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/a.jpg');
  });
  it('devolve null sem caminho', () => {
    expect(tmdbImage(null, 'w500')).toBeNull();
  });
});

describe('srcSets', () => {
  it('posterSrcSet usa 185, 342, 500 e 780', () => {
    const set = posterSrcSet('/a.jpg');
    expect(set).toContain('/w342/a.jpg 342w');
    expect(set).toContain('/w185/a.jpg 185w');
    expect(set).toContain('/w500/a.jpg 500w');
    expect(set).toContain('/w780/a.jpg 780w');
  });
  it('backdropSrcSet usa 780, 1280 e original como 1920w', () => {
    const set = backdropSrcSet('/b.jpg');
    expect(set).toContain('/w780/b.jpg 780w');
    expect(set).toContain('/w1280/b.jpg 1280w');
    expect(set).toContain('/original/b.jpg 1920w');
  });
  it('devolve undefined sem caminho', () => {
    expect(posterSrcSet(null)).toBeUndefined();
    expect(backdropSrcSet(null)).toBeUndefined();
  });
});

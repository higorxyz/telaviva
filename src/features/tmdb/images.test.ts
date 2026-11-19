import { describe, expect, it } from 'vitest';
import { backdropSrcSet, posterSrcSet, profileSrcSet, stillSrcSet, tmdbImage } from './images';

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
  it('backdropSrcSet usa 780 e 1280, e original como 3840w para telas largas e de alta densidade', () => {
    expect(backdropSrcSet('/b.jpg')).toBe(
      'https://image.tmdb.org/t/p/w780/b.jpg 780w, https://image.tmdb.org/t/p/w1280/b.jpg 1280w, https://image.tmdb.org/t/p/original/b.jpg 3840w',
    );
  });
  it('profileSrcSet e stillSrcSet oferecem versões maiores para telas de alta densidade', () => {
    expect(profileSrcSet('/p.jpg')).toBe('https://image.tmdb.org/t/p/w185/p.jpg 185w, https://image.tmdb.org/t/p/w342/p.jpg 342w');
    const still = stillSrcSet('/s.jpg');
    expect(still).toContain('/w300/s.jpg 300w');
    expect(still).toContain('/w780/s.jpg 780w');
    expect(still).not.toContain('/original/');
  });
  it('devolve undefined sem caminho', () => {
    expect(posterSrcSet(null)).toBeUndefined();
    expect(backdropSrcSet(null)).toBeUndefined();
    expect(profileSrcSet(null)).toBeUndefined();
    expect(stillSrcSet(null)).toBeUndefined();
  });
});

import { setupServer } from 'msw/node';
import { rest } from 'msw';

export const API_BASE_URL = 'https://api.themoviedb.org/3';

const sampleMovies = [
  {
    id: 1,
    title: 'Matrix Resurrections',
    overview: 'Neo retorna para a Matrix enfrentando novos desafios.',
    poster_path: '/matrix.jpg',
    backdrop_path: '/matrix-backdrop.jpg',
    release_date: '2021-12-22',
    vote_average: 7.1,
    genre_ids: [28, 878],
  },
  {
    id: 2,
    title: 'Interstellar',
    overview: 'Uma jornada épica através do espaço-tempo.',
    poster_path: '/interstellar.jpg',
    backdrop_path: '/interstellar-backdrop.jpg',
    release_date: '2014-11-07',
    vote_average: 8.6,
    genre_ids: [12, 18, 878],
  },
];

const defaultHandlers = [
  rest.get(`${API_BASE_URL}/search/movie`, (req, res, ctx) => {
    const query = req.url.searchParams.get('query')?.toLowerCase() ?? '';
    const filtered = sampleMovies.filter((movie) => movie.title.toLowerCase().includes(query));

    const totalResults = filtered.length ? Math.max(filtered.length, 6) : 0;

    return res(
      ctx.status(200),
      ctx.json({
        page: 1,
        total_pages: 1,
        total_results: totalResults,
        results: filtered,
      })
    );
  }),

  rest.get(`${API_BASE_URL}/movie/:movieId`, (req, res, ctx) => {
    const { movieId } = req.params;
    const movie = sampleMovies.find((item) => item.id === Number(movieId));

    if (!movie) {
      return res(
        ctx.status(404),
        ctx.json({ status_code: 34, status_message: 'The resource you requested could not be found.' })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        ...movie,
        runtime: 148,
        genres: movie.genre_ids?.map((genreId) => ({ id: genreId, name: `Genre ${genreId}` })) ?? [],
        translations: { translations: [] },
        release_dates: {
          results: [
            {
              iso_3166_1: 'US',
              release_dates: [
                {
                  release_date: '2021-12-22T00:00:00.000Z',
                  type: 3,
                },
              ],
            },
            {
              iso_3166_1: 'BR',
              release_dates: [
                {
                  release_date: '2022-01-13T00:00:00.000Z',
                  type: 3,
                },
              ],
            },
          ],
        },
      })
    );
  }),

  rest.get(`${API_BASE_URL}/movie/:movieId/videos`, (req, res, ctx) => {
    const { movieId } = req.params;
    const movie = sampleMovies.find((item) => item.id === Number(movieId));

    if (!movie) {
      return res(ctx.status(200), ctx.json({ results: [] }));
    }

    return res(
      ctx.status(200),
      ctx.json({
        id: movie.id,
        results: [
          {
            id: 'trailer-1',
            key: 'dQw4w9WgXcQ',
            name: `${movie.title} Official Trailer`,
            site: 'YouTube',
            type: 'Trailer',
          },
        ],
      })
    );
  }),

  rest.get(`${API_BASE_URL}/movie/:movieId/credits`, (req, res, ctx) => {
    const { movieId } = req.params;
    const movie = sampleMovies.find((item) => item.id === Number(movieId));

    if (!movie) {
      return res(ctx.status(200), ctx.json({ cast: [] }));
    }

    return res(
      ctx.status(200),
      ctx.json({
        id: movie.id,
        cast: [
          {
            id: 100,
            name: 'Keanu Reeves',
            character: 'Neo',
            profile_path: '/keanu.jpg',
          },
          {
            id: 101,
            name: 'Carrie-Anne Moss',
            character: 'Trinity',
            profile_path: null,
          },
        ],
      })
    );
  }),

  rest.get(`${API_BASE_URL}/movie/:movieId/watch/providers`, (req, res, ctx) => {
    const { movieId } = req.params;
    const movie = sampleMovies.find((item) => item.id === Number(movieId));

    if (!movie) {
      return res(ctx.status(200), ctx.json({ id: Number(movieId), results: {} }));
    }

    return res(
      ctx.status(200),
      ctx.json({
        id: movie.id,
        results: {
          BR: {
            link: 'https://www.themoviedb.org/movie/1/watch',
            flatrate: [
              {
                provider_id: 8,
                provider_name: 'Netflix',
                logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
              },
            ],
            rent: [
              {
                provider_id: 307,
                provider_name: 'Amazon Prime Video',
                logo_path: '/seGSXajazLMCKGB5hnRCidtjay1.jpg',
              },
            ],
            buy: [],
            ads: [],
            free: [],
          },
        },
      })
    );
  }),

  rest.get(`${API_BASE_URL}/watch/providers/movie`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        results: [
          {
            provider_id: 8,
            provider_name: 'Netflix',
            logo_path: '/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg',
            display_priority: 0,
          },
          {
            provider_id: 9,
            provider_name: 'Prime Video',
            logo_path: '/seGSXajazLMCKGB5hnRCidtjay1.jpg',
            display_priority: 1,
          },
          {
            provider_id: 337,
            provider_name: 'Disney Plus',
            logo_path: '/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg',
            display_priority: 2,
          },
        ],
      })
    );
  }),
];

export const server = setupServer(...defaultHandlers);
export { rest };


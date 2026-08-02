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

const samplePeople = [
  {
    id: 100,
    gender: 2,
    name: 'Keanu Reeves',
    also_known_as: ['Keanu Charles Reeves'],
    biography:
      'Keanu Charles Reeves é um ator canadense conhecido por papéis em ficção científica e ação. Sua carreira ganhou projeção internacional com Matrix e John Wick, combinando presença física e carisma em papéis marcantes ao longo de décadas.',
    birthday: '1964-09-02',
    place_of_birth: 'Beirute, Líbano',
    known_for_department: 'Acting',
    profile_path: '/keanu.jpg',
  },
  {
    id: 101,
    gender: 1,
    name: 'Carrie-Anne Moss',
    also_known_as: ['Carrie Anne Moss'],
    biography:
      'Carrie-Anne Moss é uma atriz canadense reconhecida mundialmente por interpretar Trinity na franquia Matrix.',
    birthday: '1967-08-21',
    place_of_birth: 'Burnaby, Canadá',
    known_for_department: 'Acting',
    profile_path: null,
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

  rest.get(`${API_BASE_URL}/movie/:movieId/similar`, (req, res, ctx) => {
    const { movieId } = req.params;

    if (Number(movieId) !== 1) {
      return res(
        ctx.status(200),
        ctx.json({
          page: 1,
          total_pages: 1,
          total_results: 0,
          results: [],
        })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        page: 1,
        total_pages: 1,
        total_results: 2,
        results: [
          {
            id: 21,
            title: 'John Wick',
            overview: 'Um ex-assassino retorna para uma última missão.',
            poster_path: '/john-wick.jpg',
            backdrop_path: '/john-wick-backdrop.jpg',
            release_date: '2014-10-24',
            vote_average: 7.4,
            vote_count: 16000,
            genre_ids: [28, 53],
          },
          {
            id: 23,
            title: 'A Origem',
            overview: 'Uma equipe invade sonhos para plantar uma ideia.',
            poster_path: '/inception.jpg',
            backdrop_path: '/inception-backdrop.jpg',
            release_date: '2010-07-16',
            vote_average: 8.3,
            vote_count: 35000,
            genre_ids: [28, 878, 53],
          },
        ],
      })
    );
  }),

  rest.get(`${API_BASE_URL}/movie/:movieId/recommendations`, (req, res, ctx) => {
    const { movieId } = req.params;

    if (Number(movieId) !== 1) {
      return res(
        ctx.status(200),
        ctx.json({
          page: 1,
          total_pages: 1,
          total_results: 0,
          results: [],
        })
      );
    }

    return res(
      ctx.status(200),
      ctx.json({
        page: 1,
        total_pages: 1,
        total_results: 2,
        results: [
          {
            id: 22,
            title: 'Blade Runner 2049',
            overview: 'Um novo blade runner desvenda um segredo oculto.',
            poster_path: '/blade-runner-2049.jpg',
            backdrop_path: '/blade-runner-2049-backdrop.jpg',
            release_date: '2017-10-06',
            vote_average: 8,
            vote_count: 13000,
            genre_ids: [878, 18],
          },
          {
            id: 24,
            title: 'Minority Report',
            overview: 'Um policial foge após ser acusado de um crime futuro.',
            poster_path: '/minority-report.jpg',
            backdrop_path: '/minority-report-backdrop.jpg',
            release_date: '2002-06-21',
            vote_average: 7.6,
            vote_count: 7500,
            genre_ids: [28, 878, 53],
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

  rest.get(`${API_BASE_URL}/person/:personId`, (req, res, ctx) => {
    const { personId } = req.params;
    const person = samplePeople.find((item) => item.id === Number(personId));

    if (!person) {
      return res(
        ctx.status(404),
        ctx.json({ status_code: 34, status_message: 'The resource you requested could not be found.' })
      );
    }

    return res(ctx.status(200), ctx.json(person));
  }),

  rest.get(`${API_BASE_URL}/person/:personId/movie_credits`, (req, res, ctx) => {
    const { personId } = req.params;

    if (Number(personId) === 100) {
      return res(
        ctx.status(200),
        ctx.json({
          id: 100,
          cast: [
            {
              id: 1,
              title: 'Matrix Resurrections',
              poster_path: '/matrix.jpg',
              backdrop_path: '/matrix-backdrop.jpg',
              release_date: '2021-12-22',
              vote_average: 7.1,
              popularity: 96,
              vote_count: 8900,
              order: 0,
              character: 'Neo',
            },
            {
              id: 2,
              title: 'Interstellar',
              poster_path: '/interstellar.jpg',
              backdrop_path: '/interstellar-backdrop.jpg',
              release_date: '2014-11-07',
              vote_average: 8.6,
              popularity: 88,
              vote_count: 31000,
              order: 2,
              character: 'Participação especial',
            },
            {
              id: 3,
              title: 'Filme sem poster',
              poster_path: null,
              release_date: '2010-01-01',
              vote_average: 6.1,
              popularity: 100,
              vote_count: 120,
              order: 8,
              character: 'Sem poster',
            },
          ],
          crew: [
            {
              id: 20,
              title: 'Projeto como produtor',
              poster_path: '/producer-project.jpg',
              release_date: '2019-01-01',
              vote_average: 6.8,
              popularity: 50,
              job: 'Producer',
            },
          ],
        })
      );
    }

    return res(ctx.status(200), ctx.json({ id: Number(personId), cast: [], crew: [] }));
  }),

  rest.get(`${API_BASE_URL}/person/:personId/images`, (req, res, ctx) => {
    const { personId } = req.params;

    if (Number(personId) === 100) {
      return res(
        ctx.status(200),
        ctx.json({
          id: 100,
          profiles: [
            { file_path: '/keanu-alt-1.jpg' },
            { file_path: '/keanu-alt-2.jpg' },
            { file_path: '/keanu-alt-3.jpg' },
          ],
        })
      );
    }

    return res(ctx.status(200), ctx.json({ id: Number(personId), profiles: [] }));
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


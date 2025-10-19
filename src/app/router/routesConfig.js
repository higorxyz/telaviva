import React from 'react';
import Home from '../../features/movies/pages/Home';
import MovieDetails from '../../features/movies/pages/MovieDetails';
import Genres from '../../features/movies/pages/Genres';
import Category from '../../features/movies/pages/Category';
import PopularMovies from '../../features/movies/pages/PopularMovies';
import TopRatedMovies from '../../features/movies/pages/TopRatedMovies';
import NowPlayingMovies from '../../features/movies/pages/NowPlayingMovies';
import UpcomingMovies from '../../features/movies/pages/UpcomingMovies';
import WatchedMovies from '../../features/movies/pages/WatchedMovies';
import ToWatchMovies from '../../features/movies/pages/ToWatchMovies';
import SearchResults from '../../features/movies/pages/SearchResults';
import PageNotFound from '../../pages/system/PageNotFound';
import PageContainer from '../../components/layout/PageContainer';

const withPageContainer = (Component) => (
  <PageContainer>
    <Component />
  </PageContainer>
);

export const routesConfig = [
  { path: '/', element: withPageContainer(Home) },
  { path: '/movie/:id', element: <MovieDetails /> },
  { path: '/genres', element: withPageContainer(Genres) },
  { path: '/category/:category', element: withPageContainer(Category) },
  { path: '/popular-movies', element: withPageContainer(PopularMovies) },
  { path: '/top-rated-movies', element: withPageContainer(TopRatedMovies) },
  { path: '/now-playing-movies', element: withPageContainer(NowPlayingMovies) },
  { path: '/upcoming-movies', element: withPageContainer(UpcomingMovies) },
  { path: '/watched-movies', element: withPageContainer(WatchedMovies) },
  { path: '/to-watch-movies', element: withPageContainer(ToWatchMovies) },
  { path: '/search-results', element: withPageContainer(SearchResults) },
  { path: '*', element: withPageContainer(PageNotFound) },
];

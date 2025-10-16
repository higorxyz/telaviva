import React, { useEffect, useState, useContext } from 'react';
import { fetchPopularMovies, fetchTopRatedMovies, fetchNowPlayingMovies, fetchUpcomingMovies, fetchSimilarMovies } from '../api';
import MovieSection from '../components/MovieSection';
import Loading from '../components/Loading';
import { MovieContext } from '../context/MovieContext';

const Home = () => {
  const [popularMovies, setPopularMovies] = useState([]);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [upcomingMovies, setUpcomingMovies] = useState([]);
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { toWatchMovies, watchedMovies } = useContext(MovieContext);

  useEffect(() => {
    const getMovies = async () => {
      try {
        const [popularData, topRatedData, nowPlayingData, upcomingData] = await Promise.all([
          fetchPopularMovies(),
          fetchTopRatedMovies(),
          fetchNowPlayingMovies(),
          fetchUpcomingMovies(),
        ]);
        setPopularMovies(popularData);
        setTopRatedMovies(topRatedData);
        setNowPlayingMovies(nowPlayingData);
        setUpcomingMovies(upcomingData);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
      }
    };
    getMovies();
  }, []);

  useEffect(() => {
    const getRecommendedMovies = async () => {
      try {
        const similarMovies = [];
        
        const allMovies = [...toWatchMovies, ...watchedMovies];
        
        // Limita a 5 filmes para melhor performance
        const limitedMovies = allMovies.slice(0, 5);
        
        for (const movie of limitedMovies) {
          const similarData = await fetchSimilarMovies(movie.id);
          similarMovies.push(...similarData);
        }
        
        const uniqueRecommendedMovies = Array.from(new Set(similarMovies.map(a => a.id)))
          .map(id => similarMovies.find(a => a.id === id));
          
        setRecommendedMovies(uniqueRecommendedMovies.slice(0, 12));
      } catch (err) {
        console.error('Erro ao carregar filmes recomendados:', err);
      }
    };
    
    if (toWatchMovies.length > 0 || watchedMovies.length > 0) {
      getRecommendedMovies();
    }
  }, [toWatchMovies, watchedMovies]);

  if (loading) return <Loading />;
  if (error) return <div className="text-red-500 text-center mt-6">{error}</div>;

  const displayedPopularMovies = popularMovies.slice(0, 12);
  const displayedTopRatedMovies = topRatedMovies.slice(0, 12);
  const displayedNowPlayingMovies = nowPlayingMovies.slice(0, 12);
  const displayedUpcomingMovies = upcomingMovies.slice(0, 12);

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <MovieSection 
        title="Em Cartaz" 
        movies={displayedNowPlayingMovies} 
        linkTo="/now-playing-movies" 
      />

      {recommendedMovies.length > 0 && (
        <MovieSection 
          title="Recomendados para Você" 
          movies={recommendedMovies} 
          showViewAll={false}
        />
      )}

      <MovieSection 
        title="Maiores Avaliações" 
        movies={displayedTopRatedMovies} 
        linkTo="/top-rated-movies" 
      />

      <MovieSection 
        title="Populares" 
        movies={displayedPopularMovies} 
        linkTo="/popular-movies" 
      />

      <MovieSection 
        title="Lançamentos" 
        movies={displayedUpcomingMovies} 
        linkTo="/upcoming-movies" 
      />
    </div>
  );
};

export default Home;

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../api';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import PageSEO from '../../../components/seo/PageSEO';
import GenreCard from '../components/GenreCard';

const getGenreGridColumns = (width) => {
  if (width >= 1536) {
    return 8;
  }

  if (width >= 1280) {
    return 7;
  }

  if (width >= 1024) {
    return 6;
  }

  if (width >= 768) {
    return 5;
  }

  if (width >= 640) {
    return 4;
  }

  return 3;
};

const getGenreGridGap = (width) => {
  if (width >= 1024) {
    return 20;
  }

  if (width >= 768) {
    return 16;
  }

  return 12;
};

const GenreCardSkeleton = () => (
  <div className="relative h-[200px] rounded-xl overflow-hidden bg-neutral-800 animate-pulse">
    <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-900" />
  </div>
);

const Genres = () => {
  const { data: genres, status, error } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const [gridColumns, setGridColumns] = React.useState(() => {
    if (typeof window === 'undefined') {
      return 3;
    }

    return getGenreGridColumns(window.innerWidth);
  });

  const [gridGap, setGridGap] = React.useState(() => {
    if (typeof window === 'undefined') {
      return 12;
    }

    return getGenreGridGap(window.innerWidth);
  });

  React.useEffect(() => {
    const handleResize = () => {
      setGridColumns(getGenreGridColumns(window.innerWidth));
      setGridGap(getGenreGridGap(window.innerWidth));
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const { fullRowGenres, lastRowGenres } = React.useMemo(() => {
    if (!Array.isArray(genres) || genres.length === 0) {
      return {
        fullRowGenres: [],
        lastRowGenres: [],
      };
    }

    const genreEntries = genres.map((genre, index) => ({
      genre,
      index,
    }));

    const remainder = genreEntries.length % gridColumns;

    if (remainder === 0) {
      return {
        fullRowGenres: genreEntries,
        lastRowGenres: [],
      };
    }

    const startOfLastRow = genreEntries.length - remainder;

    return {
      fullRowGenres: genreEntries.slice(0, startOfLastRow),
      lastRowGenres: genreEntries.slice(startOfLastRow),
    };
  }, [genres, gridColumns]);

  const lastRowCardWidth = React.useMemo(() => {
    const totalGapWidth = (gridColumns - 1) * gridGap;
    return `calc((100% - ${totalGapWidth}px) / ${gridColumns})`;
  }, [gridColumns, gridGap]);

  if (status === 'pending') {
    return (
      <>
        <PageSEO
          title="Gêneros"
          description="Navegue pelos gêneros disponíveis e encontre filmes sob medida para o seu gosto."
          url="/genres"
        />
        <div className="min-h-screen bg-black text-white pt-24 pb-8">
          <div className="max-w-[2000px] mx-auto">
            <div className="px-4 md:px-6 lg:px-8 xl:px-10 mb-8">
              <div className="h-10 w-64 bg-neutral-800 rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-5 px-4 md:px-6 lg:px-8 xl:px-10">
              {Array.from({ length: 18 }).map((_, index) => (
                <GenreCardSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        <PageSEO
          title="Gêneros"
          description="Navegue pelos gêneros disponíveis e encontre filmes sob medida para o seu gosto."
          url="/genres"
        />
        <div className="min-h-screen bg-black flex items-center justify-center pt-24 pb-20">
          <ErrorMessage message={error instanceof Error ? error.message : 'Erro ao carregar os gêneros.'} />
        </div>
      </>
    );
  }

  if (!genres || genres.length === 0) {
    return (
      <>
        <PageSEO
          title="Gêneros"
          description="Navegue pelos gêneros disponíveis e encontre filmes sob medida para o seu gosto."
          url="/genres"
        />
        <div className="min-h-screen bg-black text-white flex items-center justify-center pt-24 pb-20">
          <div className="text-center">
            <div className="text-6xl mb-4">🎭</div>
            <h2 className="text-2xl font-bold mb-2">Nenhum gênero encontrado</h2>
            <p className="text-gray-400">Não há gêneros disponíveis no momento.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageSEO
        title="Gêneros"
        description="Navegue pelos gêneros disponíveis e encontre filmes sob medida para o seu gosto."
        url="/genres"
      />
      <div className="min-h-screen bg-black text-white pt-24 pb-8">
        <div className="max-w-[2000px] mx-auto">
          {/* Header com título */}
          <div className="px-4 md:px-6 lg:px-8 xl:px-10 mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">
              Gêneros
            </h1>
          </div>

          {/* Grid de gêneros */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-5 px-4 md:px-6 lg:px-8 xl:px-10">
            {fullRowGenres.map((entry) => (
              <GenreCard key={entry.genre.id} genre={entry.genre} index={entry.index} />
            ))}
          </div>

          {lastRowGenres.length > 0 && (
            <div className={`${fullRowGenres.length > 0 ? 'mt-3 md:mt-4 lg:mt-5 ' : ''}px-4 md:px-6 lg:px-8 xl:px-10`}>
              <div className="flex justify-center gap-3 md:gap-4 lg:gap-5">
                {lastRowGenres.map((entry) => (
                  <div key={entry.genre.id} style={{ width: lastRowCardWidth, flex: '0 0 auto' }}>
                    <GenreCard genre={entry.genre} index={entry.index} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mensagem de fim */}
          <div className="flex flex-col items-center py-12">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-tv-accent to-transparent rounded-full mb-4" />
            <p className="text-sm md:text-base text-gray-400 text-center">
              Você visualizou todos os gêneros disponíveis
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Genres;
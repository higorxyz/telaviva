import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../api';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import PageSEO from '../../../components/seo/PageSEO';
import GenreCard from '../components/GenreCard';

const GenreCardSkeleton = () => (
  <div className="relative aspect-[2/1] rounded-xl overflow-hidden bg-neutral-800 animate-pulse">
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
              <div className="h-10 w-64 bg-neutral-800 rounded-lg animate-pulse mb-3" />
              <div className="h-5 w-48 bg-neutral-800 rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-6 px-4 md:px-6 lg:px-8 xl:px-10">
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
          {/* Header com título e contador */}
          <div className="px-4 md:px-6 lg:px-8 xl:px-10 mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">
              Gêneros
            </h1>
            <p className="text-sm md:text-base text-gray-400">
              Explore {genres.length} {genres.length === 1 ? 'gênero disponível' : 'gêneros disponíveis'}
            </p>
          </div>

          {/* Grid de gêneros */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-6 px-4 md:px-6 lg:px-8 xl:px-10">
            {genres.map((genre, index) => (
              <GenreCard key={genre.id} genre={genre} index={index} />
            ))}
          </div>

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
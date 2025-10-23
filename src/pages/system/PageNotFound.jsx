import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaFilm, FaChevronRight } from 'react-icons/fa';
import PageSEO from '../../components/seo/PageSEO';

const PageNotFound = () => {
  const [glitchActive, setGlitchActive] = useState(false);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 1800);

    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <>
      <PageSEO
        title="Página não encontrada"
        description="A página que você tentou acessar não existe. Volte para a TelaViva e continue explorando filmes."
        url="/404"
      />
      <div className="relative min-h-screen bg-black text-white overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-tv-accent/20 rounded-full blur-[128px] animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-tv-accent/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1000ms' }} />
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
          <div className="h-full w-full" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)'
          }} />
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-8 bg-neutral-900 border-r-2 border-neutral-800 opacity-40">
          <div className="flex flex-col h-full justify-around py-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-4 mx-1 bg-neutral-800 rounded-sm" />
            ))}
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-neutral-900 border-l-2 border-neutral-800 opacity-40">
          <div className="flex flex-col h-full justify-around py-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-4 mx-1 bg-neutral-800 rounded-sm" />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-16 md:py-20 max-w-4xl mx-auto text-center">
          
          <div className="relative mb-10 md:mb-14">
            <div className="absolute inset-0 blur-xl opacity-20 animate-pulse" style={{
              background: 'radial-gradient(circle, rgba(229, 9, 20, 0.2) 0%, transparent 70%)',
              transform: 'scale(1.0)',
            }} />
            
            <div className="relative text-[8rem] sm:text-[11rem] md:text-[14rem] lg:text-[17rem] font-black leading-none select-none">
              <span 
                className="inline-block transition-all duration-300 hover:scale-105"
                style={{
                  background: 'linear-gradient(180deg, #ff3838 0%, #E50914 40%, #b30710 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 20px rgba(229, 9, 20, 0.3)) drop-shadow(0 0 10px rgba(255, 56, 56, 0.2))',
                }}
              >
                404
              </span>
            </div>
            
            {glitchActive && (
              <>
                <div 
                  className="absolute inset-0 text-[8rem] sm:text-[11rem] md:text-[14rem] lg:text-[17rem] font-black leading-none select-none pointer-events-none"
                  style={{
                    color: '#00ffff',
                    opacity: 0.25,
                    transform: 'translate(4px, 3px)',
                    filter: 'blur(2px)',
                    zIndex: -1
                  }}
                >
                  404
                </div>
                <div 
                  className="absolute inset-0 text-[8rem] sm:text-[11rem] md:text-[14rem] lg:text-[17rem] font-black leading-none select-none pointer-events-none"
                  style={{
                    color: '#ff00ff',
                    opacity: 0.25,
                    transform: 'translate(-4px, -3px)',
                    filter: 'blur(2px)',
                    zIndex: -1
                  }}
                >
                  404
                </div>
              </>
            )}
          </div>

          <div className="mb-6 relative">
            <div className="absolute inset-0 blur-2xl bg-tv-accent/30 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative bg-neutral-900/90 backdrop-blur-sm p-5 rounded-full border-2 border-tv-accent/40 shadow-2xl shadow-tv-accent/30 transition-all duration-300 hover:scale-10 hover:border-tv-accent/60">
              <FaFilm className="text-tv-accent text-6xl md:text-7xl" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white drop-shadow-2xl tracking-tight">
            Cena Não Encontrada
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-4 max-w-2xl leading-relaxed font-medium px-4">
            Parece que este filme não está em nossa biblioteca.
          </p>
          
          <p className="text-base md:text-lg text-gray-500 mb-14 max-w-xl leading-relaxed px-4">
            A página que você procura foi movida, deletada ou nunca existiu neste universo cinematográfico.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md">
            <Link
              to="/"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-tv-accent hover:bg-tv-accent-hover text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 shadow-lg shadow-tv-accent/30 hover:shadow-tv-accent/50 hover:scale-105 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <FaHome className="text-xl relative z-10" />
              <span className="relative z-10">Voltar ao Início</span>
            </Link>
            
            <Link
              to="/popular-movies"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-neutral-800/80 backdrop-blur-sm hover:bg-neutral-700 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 border-2 border-neutral-700 hover:border-neutral-600 hover:scale-105"
            >
              <span>Explorar Filmes</span>
              <FaChevronRight className="text-sm group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="mt-16 flex items-center gap-4 text-sm text-gray-600 font-medium">
            <div className="h-px w-20 bg-gradient-to-r from-transparent via-tv-accent/30 to-neutral-800" />
            <span className="uppercase tracking-[0.3em]">Erro 404</span>
            <div className="h-px w-20 bg-gradient-to-l from-transparent via-tv-accent/30 to-neutral-800" />
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-tv-accent/30 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default PageNotFound;
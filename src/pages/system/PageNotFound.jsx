import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaChevronRight, FaFilm, FaHome } from 'react-icons/fa';
import PageSEO from '../../components/seo/PageSEO';

const QUICK_LINKS = [
  {
    to: '/discover',
    label: 'Descobrir filmes',
  },
  {
    to: '/trending-movies',
    label: 'Tendências da semana',
  },
  {
    to: '/popular-movies',
    label: 'Filmes populares',
  },
];

const PageNotFound = () => {
  const [glitchActive, setGlitchActive] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 1800);

    return () => clearInterval(glitchInterval);
  }, []);

  const requestedPath = useMemo(() => {
    const rawPath = `${location.pathname || ''}${location.search || ''}${location.hash || ''}`;

    if (!rawPath) {
      return '/';
    }

    try {
      return decodeURIComponent(rawPath);
    } catch {
      return rawPath;
    }
  }, [location.hash, location.pathname, location.search]);

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };


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

        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-10 md:py-12 max-w-4xl mx-auto text-center">

          <div className="relative mb-5 md:mb-6">
            <div className="absolute inset-0 blur-xl opacity-20 animate-pulse" style={{
              background: 'radial-gradient(circle, rgba(229, 9, 20, 0.2) 0%, transparent 70%)',
              transform: 'scale(1.0)',
            }} />

            <div className="relative text-[5.5rem] sm:text-[7.5rem] md:text-[9.5rem] lg:text-[11rem] font-black leading-none select-none">
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
                  className="absolute inset-0 text-[5.5rem] sm:text-[7.5rem] md:text-[9.5rem] lg:text-[11rem] font-black leading-none select-none pointer-events-none"
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
                  className="absolute inset-0 text-[5.5rem] sm:text-[7.5rem] md:text-[9.5rem] lg:text-[11rem] font-black leading-none select-none pointer-events-none"
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

          <div className="mb-4 relative">
            <div className="absolute inset-0 blur-2xl bg-tv-accent/30 rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative bg-neutral-900/90 backdrop-blur-sm p-4 rounded-full border-2 border-tv-accent/40 shadow-2xl shadow-tv-accent/30 transition-all duration-300 hover:scale-10 hover:border-tv-accent/60">
              <FaFilm className="text-tv-accent text-5xl md:text-6xl" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white drop-shadow-2xl tracking-tight">
            Cena Não Encontrada
          </h1>

          <p className="text-base md:text-lg text-gray-300 mb-2 max-w-2xl leading-relaxed font-medium px-4">
            Parece que este filme não está em nossa biblioteca.
          </p>

          <p className="text-sm md:text-base text-gray-500 mb-2 max-w-xl leading-relaxed px-4">
            A página que você procura foi movida, deletada ou nunca existiu neste universo cinematográfico.
          </p>

          <p className="mb-7 max-w-2xl break-all px-4 text-[11px] text-gray-600 md:text-xs">
            URL acessada: <span className="font-mono text-gray-500">{requestedPath}</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center w-full max-w-lg">
            <button
              type="button"
              onClick={handleGoBack}
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-neutral-800/80 backdrop-blur-sm hover:bg-neutral-700 text-white font-semibold px-7 py-3 rounded-xl transition-all duration-300 border-2 border-neutral-700 hover:border-neutral-600 hover:scale-105"
            >
              <FaArrowLeft className="text-sm group-hover:-translate-x-0.5 transition-transform" />
              <span>Voltar</span>
            </button>

            <Link
              to="/"
              className="group btn-minimal-rect w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl px-7 py-3 font-semibold text-white"
            >
              <FaHome className="text-xl transition-transform duration-300 group-hover:-translate-y-0.5" />
              <span>Voltar ao Início</span>
            </Link>
          </div>

          <div className="mt-4 flex flex-col items-center gap-1.5 px-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-gray-600">Atalhos rápidos</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group inline-flex items-center gap-1 text-xs md:text-sm text-gray-400 transition-colors duration-300 hover:text-tv-accent"
                >
                  <span>{link.label}</span>
                  <FaChevronRight className="text-[10px] transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-7 flex items-center gap-3 text-xs text-gray-600 font-medium">
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
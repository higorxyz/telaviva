import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../logo/Logo';
import { FaGithub, FaLinkedin, FaHeart } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { label: 'Início', path: '/' },
    { label: 'Em Cartaz', path: '/now-playing-movies' },
    { label: 'Populares', path: '/popular-movies' },
    { label: 'Alta Avaliação', path: '/top-rated-movies' },
    { label: 'Em Breve', path: '/upcoming-movies' },
  ];

  return (
    <footer className="w-full bg-gradient-to-b from-black via-black to-neutral-950 text-white mt-24">
      <div className="w-full h-px bg-gradient-to-r from-transparent via-tv-accent/30 to-transparent"></div>
      
      <div className="w-full px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-screen-xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          
          <div className="text-center md:text-left">
            <Link to="/" className="inline-block">
              <div className="flex items-center justify-center md:justify-start mb-4">
                <Logo size="medium" />
              </div>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Sua plataforma completa para descobrir, explorar e acompanhar os melhores filmes do cinema mundial.
            </p>
            <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-gray-600">
              <span>Powered by</span>
              <span className="text-tv-accent font-semibold">TMDB API</span>
            </div>
          </div>

          <div className="text-center md:text-left">
            <h4 className="text-lg font-semibold mb-6 text-gray-200">Links Rápidos</h4>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-tv-accent transition-colors duration-200 text-sm inline-flex items-center gap-2 group"
                  >
                    <span className="w-1 h-1 bg-tv-accent/50 rounded-full group-hover:w-2 transition-all duration-200"></span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center md:text-right">
            <h4 className="text-lg font-semibold mb-6 text-gray-200">Conecte-se</h4>
            <p className="text-gray-400 text-sm mb-6">
              Siga o desenvolvimento e fique por dentro das novidades
            </p>
            <div className="flex gap-3 justify-center md:justify-end">
              <a
                href="https://github.com/higorxyz"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative p-4 bg-neutral-900/50 rounded-xl hover:bg-neutral-800 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 border border-neutral-800 hover:border-neutral-700"
                aria-label="GitHub"
              >
                <FaGithub size={22} className="text-gray-400 group-hover:text-white transition-colors" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-xs py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                  GitHub
                </span>
              </a>
              <a
                href="https://www.linkedin.com/in/higorbatista"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative p-4 bg-neutral-900/50 rounded-xl hover:bg-neutral-800 transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 border border-neutral-800 hover:border-blue-500/30"
                aria-label="LinkedIn"
              >
                <FaLinkedin size={22} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-xs py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                  LinkedIn
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="relative w-full h-px bg-gradient-to-r from-transparent via-neutral-800 to-transparent mb-8">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-4">
            <div className="w-2 h-2 bg-tv-accent/50 rounded-full"></div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500 text-center md:text-left">
            © {currentYear} <span className="text-gray-400 font-medium">TelaViva</span>. Todos os direitos reservados.
          </p>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Desenvolvido com</span>
            <FaHeart className="text-tv-accent animate-pulse" size={11} />
            <span>por</span>
            <a 
              href="https://github.com/higorxyz" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-gray-400 hover:text-tv-accent transition-colors"
            >
              Higor Batista
            </a>
          </div>
        </div>
        </div>
      </div>

      <div className="w-full h-1 bg-gradient-to-r from-transparent via-tv-accent/20 to-transparent"></div>
    </footer>
  );
};

export default Footer;
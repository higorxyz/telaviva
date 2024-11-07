import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('/');

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleLinkClick = (link) => {
    setActiveLink(link);
  };

  return (
    <nav className="bg-black text-white py-4 px-6 shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="text-3xl font-bold text-[#bd0003]"
          style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold' }}
        >
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:hidden relative">
          <button
            onClick={toggleMenu}
            className="text-white transition-transform duration-300 ease-in-out transform hover:scale-105"
          >
            {menuOpen ? <FaTimes size={30} /> : <FaBars size={30} />}
          </button>
          {menuOpen && (
            <div className="absolute top-12 right-0 bg-black text-white w-56 py-4 px-6 shadow-lg z-50">
              <ul className="space-y-4">
                <li>
                  <Link
                    to="/"
                    onClick={() => handleLinkClick('/')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Início
                  </Link>
                </li>
                <li>
                  <Link
                    to="/genres"
                    onClick={() => handleLinkClick('/genres')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/genres' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Gêneros
                  </Link>
                </li>
                <li>
                  <Link
                    to="/watched-movies"
                    onClick={() => handleLinkClick('/watched-movies')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/watched-movies' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Assistidos
                  </Link>
                </li>
                <li>
                  <Link
                    to="/to-watch-movies"
                    onClick={() => handleLinkClick('/to-watch-movies')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/to-watch-movies' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Ver Depois
                  </Link>
                </li>
                <li>
                  <Link
                    to="/popular-movies"
                    onClick={() => handleLinkClick('/popular-movies')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/popular-movies' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Populares
                  </Link>
                </li>
                <li>
                  <Link
                    to="/top-rated-movies"
                    onClick={() => handleLinkClick('/top-rated-movies')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/top-rated-movies' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Alta Avaliação
                  </Link>
                </li>
                <li>
                  <Link
                    to="/now-playing-movies"
                    onClick={() => handleLinkClick('/now-playing-movies')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/now-playing-movies' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Agora Em Cartaz
                  </Link>
                </li>
                <li>
                  <Link
                    to="/upcoming-movies"
                    onClick={() => handleLinkClick('/upcoming-movies')}
                    className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/upcoming-movies' ? 'bg-[#bd0003] text-white' : ''}`}
                  >
                    Em Breve
                  </Link>
                </li>
              </ul>
            </div>
          )}
        </div>
        <ul className="md:flex space-x-4 items-center md:flex-row transition-all duration-300 ease-in-out hidden md:block">
          <li>
            <Link
              to="/"
              onClick={() => handleLinkClick('/')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Início
            </Link>
          </li>
          <li>
            <Link
              to="/genres"
              onClick={() => handleLinkClick('/genres')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/genres' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Gêneros
            </Link>
          </li>
          <li>
            <Link
              to="/watched-movies"
              onClick={() => handleLinkClick('/watched-movies')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/watched-movies' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Assistidos
            </Link>
          </li>
          <li>
            <Link
              to="/to-watch-movies"
              onClick={() => handleLinkClick('/to-watch-movies')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/to-watch-movies' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Ver Depois
            </Link>
          </li>
          <li>
            <Link
              to="/popular-movies"
              onClick={() => handleLinkClick('/popular-movies')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/popular-movies' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Populares
            </Link>
          </li>
          <li>
            <Link
              to="/top-rated-movies"
              onClick={() => handleLinkClick('/top-rated-movies')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/top-rated-movies' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Alta Avaliação
            </Link>
          </li>
          <li>
            <Link
              to="/now-playing-movies"
              onClick={() => handleLinkClick('/now-playing-movies')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/now-playing-movies' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Agora Em Cartaz
            </Link>
          </li>
          <li>
            <Link
              to="/upcoming-movies"
              onClick={() => handleLinkClick('/upcoming-movies')}
              className={`text-[#bd0003] hover:text-gray-300 hover:shadow-lg px-2 py-1 rounded-md transition-all duration-300 ${activeLink === '/upcoming-movies' ? 'bg-[#bd0003] text-white' : ''}`}
            >
              Em Breve
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

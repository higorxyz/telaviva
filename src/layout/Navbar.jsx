import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  const handleSearch = () => {
    if (searchQuery.trim() === '') return;
    navigate(`/search-results?query=${searchQuery}`);
  };

  const toggleSearch = () => setSearchOpen(!searchOpen);

  const isActiveLink = (path) => location.pathname === path;

  return (
    <nav className="bg-black text-white py-4 px-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-3xl font-bold text-[#bd0003]" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold' }}>
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:flex items-center justify-end space-x-4 hidden">
          <ul className="flex space-x-4 items-center">
            <li>
              <Link
                to="/"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Início
              </Link>
            </li>
            <li>
              <Link
                to="/genres"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/genres') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Gêneros
              </Link>
            </li>
            <li>
              <Link
                to="/watched-movies"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/watched-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Assistidos
              </Link>
            </li>
            <li>
              <Link
                to="/to-watch-movies"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/to-watch-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Ver Depois
              </Link>
            </li>
            <li>
              <Link
                to="/popular-movies"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/popular-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Populares
              </Link>
            </li>
            <li>
              <Link
                to="/top-rated-movies"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/top-rated-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Alta Avaliação
              </Link>
            </li>
            <li>
              <Link
                to="/now-playing-movies"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/now-playing-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Em Cartaz
              </Link>
            </li>
            <li>
              <Link
                to="/upcoming-movies"
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/upcoming-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                Em Breve
              </Link>
            </li>
          </ul>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-48 px-4 py-2 rounded-full bg-neutral-800 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-[#bd0003]"
              placeholder="Pesquisar filmes"
            />
            <button onClick={handleSearch} className="absolute right-2 top-2 text-[#bd0003]">
              <FaSearch size={20} />
            </button>
          </div>
        </div>
        <div className="md:hidden flex items-center">
          {!searchOpen ? (
            <button onClick={toggleSearch} className="text-white mr-3">
              <FaSearch size={20} />
            </button>
          ) : (
            <div className="flex items-center w-48">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full px-4 py-2 rounded-full bg-neutral-800 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-[#bd0003]"
                placeholder="Pesquisar filmes"
              />
              <button onClick={handleSearch} className="text-[#bd0003] ml-2">
                <FaSearch size={20} />
              </button>
            </div>
          )}
          <button onClick={toggleMenu} className="text-white">
            {menuOpen ? <FaTimes size={30} /> : <FaBars size={30} />}
          </button>
        </div>
      </div>

      <div
        className={`fixed top-0 left-0 w-full h-full bg-black bg-opacity-75 md:hidden ${
          menuOpen ? 'block' : 'hidden'
        }`}
        onClick={toggleMenu}
      >
        <div className="flex justify-end p-6">
          <button onClick={toggleMenu} className="text-white">
            <FaTimes size={30} />
          </button>
        </div>
        <div className="flex flex-col items-center space-y-4 text-white">
          <Link
            to="/"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Início
          </Link>
          <Link
            to="/genres"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Gêneros
          </Link>
          <Link
            to="/watched-movies"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Assistidos
          </Link>
          <Link
            to="/to-watch-movies"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Ver Depois
          </Link>
          <Link
            to="/popular-movies"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Populares
          </Link>
          <Link
            to="/top-rated-movies"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Alta Avaliação
          </Link>
          <Link
            to="/now-playing-movies"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Em Cartaz
          </Link>
          <Link
            to="/upcoming-movies"
            className="text-[#bd0003] hover:text-gray-300 px-2 py-1 rounded-full"
          >
            Em Breve
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

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
        <Link to="/" className="text-3xl font-bold" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold', color: '#bd0003' }}>
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:hidden flex items-center">
          {!searchOpen ? (
            <button onClick={toggleSearch} className="text-white mr-3">
              <FaSearch size={20} />
            </button>
          ) : (
            <div className="flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-40 px-4 py-2 rounded-full bg-neutral-800 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-[#bd0003]"
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
        <ul className={`md:flex space-x-4 items-center md:flex-row ${menuOpen ? 'block' : 'hidden'} md:block`}>
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
              Agora Em Cartaz
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
        <div className={`md:flex space-x-4 items-center ${searchOpen ? 'block' : 'hidden'} md:block`}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-2 rounded-full bg-neutral-800 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-[#bd0003]"
              placeholder="Pesquisar filmes"
            />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-2 text-[#bd0003]"
            >
              <FaSearch size={20} />
            </button>
          </div>
        </div>
      </div>
      <div className={`absolute top-16 right-0 mt-2 bg-black text-white w-56 ${menuOpen ? 'block' : 'hidden'} md:hidden`}>
        <ul>
          <li>
            <Link
              to="/"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/') ? 'border-2 border-[#bd0003] text-white' : ''}`}
            >
              Início
            </Link>
          </li>
          <li>
            <Link
              to="/genres"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/genres') ? 'border-2 border-[#bd0003] text-white' : ''}`}
            >
              Gêneros
            </Link>
          </li>
          <li>
            <Link
              to="/watched-movies"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/watched-movies') ? 'border-2 border-[#bd0003] text-white' : ''}`}
            >
              Assistidos
            </Link>
          </li>
          <li>
            <Link
              to="/to-watch-movies"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/to-watch-movies') ? 'border-2 border-[#bd0003] text-white' : ''}`}
            >
              Ver Depois
            </Link>
          </li>
          <li>
            <Link
              to="/popular-movies"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/popular-movies') ? 'border-2 border-[#bd0003] text-white' : ''}`}
            >
              Populares
            </Link>
          </li>
          <li>
            <Link
              to="/top-rated-movies"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/top-rated-movies') ? 'border-2 border-[#bd0003] text-white' : ''}`}
            >
              Alta Avaliação
            </Link>
          </li>
          <li>
            <Link
              to="/now-playing-movies"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/now-playing-movies') ? 'border-2 border-[#bd0003] text-white' : ''}`}
            >
              Agora Em Cartaz
            </Link>
          </li>
          <li>
            <Link
              to="/upcoming-movies"
              className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink('/upcoming-movies') ? 'border-2 border-[#bd0003] text-white' : ''}`}
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

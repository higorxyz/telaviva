import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  const handleSearch = () => {
    if (searchQuery.trim() === '') return;
    navigate(`/search-results?query=${searchQuery}`);
  };

  const toggleSearch = () => setSearchOpen(!searchOpen);

  return (
    <nav className="bg-black text-white py-4 px-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-3xl font-bold text-red-500" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold' }}>
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:hidden flex items-center">
          <button onClick={toggleSearch} className="text-white mr-3">
            <FaSearch size={20} />
          </button>
          <button onClick={toggleMenu} className="text-white">
            {menuOpen ? <FaTimes size={30} /> : <FaBars size={30} />}
          </button>
        </div>
        <ul className={`md:flex space-x-4 items-center md:flex-row ${menuOpen ? 'block' : 'hidden'} md:block`}>
          <li>
            <Link to="/" className="text-red-500 hover:text-gray-300">Início</Link>
          </li>
          <li>
            <Link to="/genres" className="text-red-500 hover:text-gray-300">Gêneros</Link>
          </li>
          <li>
            <Link to="/watched-movies" className="text-red-500 hover:text-gray-300">Assistidos</Link>
          </li>
          <li>
            <Link to="/to-watch-movies" className="text-red-500 hover:text-gray-300">Ver Depois</Link>
          </li>
          <li>
            <Link to="/popular-movies" className="text-red-500 hover:text-gray-300">Populares</Link>
          </li>
          <li>
            <Link to="/top-rated-movies" className="text-red-500 hover:text-gray-300">Alta Avaliação</Link>
          </li>
          <li>
            <Link to="/now-playing-movies" className="text-red-500 hover:text-gray-300">Agora Em Cartaz</Link>
          </li>
          <li>
            <Link to="/upcoming-movies" className="text-red-500 hover:text-gray-300">Em Breve</Link>
          </li>
          <li className="relative">
            <button
              onClick={toggleSearch}
              className={`text-white ${searchOpen ? 'hidden' : 'block'}`}
            >
              <FaSearch size={20} />
            </button>
            {searchOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 md:w-80 bg-neutral-800 p-2 rounded-md">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-4 py-2 rounded-full bg-neutral-800 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Pesquisar filmes"
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-2 top-2 text-red-500"
                >
                  <FaSearch size={20} />
                </button>
              </div>
            )}
          </li>
        </ul>
        <div className={`md:flex space-x-4 items-center ${searchOpen ? 'block' : 'hidden'} md:block`}>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-4 py-2 rounded-full bg-neutral-800 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Pesquisar filmes"
            />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-2 text-red-500"
            >
              <FaSearch size={20} />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const toggleSearch = () => setSearchOpen(!searchOpen);
  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  return (
    <nav className="bg-black text-white py-4 px-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-3xl font-bold text-red-500" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold' }}>
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:flex items-center">
          <div className="md:flex hidden">
            <button onClick={toggleSearch} className="text-white">
              <FaSearch size={24} />
            </button>
            {searchOpen && (
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="ml-2 py-1 px-3 bg-white text-black rounded"
                placeholder="Pesquisar"
              />
            )}
          </div>
          <div className="md:hidden">
            <button onClick={toggleSearch} className="text-white">
              <FaSearch size={24} />
            </button>
            {searchOpen && (
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="ml-2 py-1 px-3 bg-white text-black rounded"
                placeholder="Pesquisar"
              />
            )}
          </div>
          <div className="md:hidden">
            <button onClick={toggleMenu} className="text-white">
              {menuOpen ? <FaTimes size={30} /> : <FaBars size={30} />}
            </button>
          </div>
        </div>
      </div>
      <ul className={`md:flex space-x-4 items-center md:flex-row ${menuOpen ? 'block' : 'hidden'} md:block`}>
        <li>
          <Link to="/" className="text-red-500 hover:text-white py-2 px-3 rounded">Início</Link>
        </li>
        <li>
          <Link to="/genres" className="text-red-500 hover:text-white py-2 px-3 rounded">Gêneros</Link>
        </li>
        <li>
          <Link to="/watched-movies" className="text-red-500 hover:text-white py-2 px-3 rounded">Assistidos</Link>
        </li>
        <li>
          <Link to="/to-watch-movies" className="text-red-500 hover:text-white py-2 px-3 rounded">Ver Depois</Link>
        </li>
        <li>
          <Link to="/popular-movies" className="text-red-500 hover:text-white py-2 px-3 rounded">Populares</Link>
        </li>
        <li>
          <Link to="/top-rated-movies" className="text-red-500 hover:text-white py-2 px-3 rounded">Alta Avaliação</Link>
        </li>
        <li>
          <Link to="/now-playing-movies" className="text-red-500 hover:text-white py-2 px-3 rounded">Agora Em Cartaz</Link>
        </li>
        <li>
          <Link to="/upcoming-movies" className="text-red-500 hover:text-white py-2 px-3 rounded">Em Breve</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;

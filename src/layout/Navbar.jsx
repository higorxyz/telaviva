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
          {['Início', 'Gêneros', 'Assistidos', 'Ver Depois', 'Populares', 'Alta Avaliação', 'Agora Em Cartaz', 'Em Breve'].map((text, index) => (
            <li key={index}>
              <Link
                to={`/${text.toLowerCase().replace(/\s+/g, '-')}`}
                className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink(`/${text.toLowerCase().replace(/\s+/g, '-')}`) ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}
              >
                {text}
              </Link>
            </li>
          ))}
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
          {['Início', 'Gêneros', 'Assistidos', 'Ver Depois', 'Populares', 'Alta Avaliação', 'Agora Em Cartaz', 'Em Breve'].map((text, index) => (
            <li key={index}>
              <Link
                to={`/${text.toLowerCase().replace(/\s+/g, '-')}`}
                className={`block py-2 px-4 text-[#bd0003] hover:text-gray-300 ${isActiveLink(`/${text.toLowerCase().replace(/\s+/g, '-')}`) ? 'border-2 border-[#bd0003] text-white' : ''}`}
              >
                {text}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

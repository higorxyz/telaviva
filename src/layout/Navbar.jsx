import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import { fetchMoviesBySearch } from './api';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  const fetchSearchResults = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await fetchMoviesBySearch(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error fetching search results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const timer = setTimeout(() => {
        fetchSearchResults(searchQuery);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const toggleSearch = () => setSearchOpen(!searchOpen);

  const isActiveLink = (path) => location.pathname === path;

  const handleClickOutside = (e) => {
    if (searchOpen && searchInputRef.current && !searchInputRef.current.contains(e.target)) {
      setSearchOpen(false);
    }
  };

  React.useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [searchOpen]);

  return (
    <nav className="bg-black text-white py-4 px-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-3xl font-bold text-[#bd0003]" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold' }}>
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:flex items-center justify-end space-x-6 hidden">
          <ul className="flex space-x-4 items-center">
            <li>
              <Link to="/now-playing-movies" className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/now-playing-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}>
                Agora Em Cartaz
              </Link>
            </li>
            <li>
              <Link to="/popular-movies" className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/popular-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}>
                Populares
              </Link>
            </li>
            <li>
              <Link to="/top-rated-movies" className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/top-rated-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}>
                Alta Avaliação
              </Link>
            </li>
            <li>
              <Link to="/upcoming-movies" className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/upcoming-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}>
                Em Breve
              </Link>
            </li>
            <li>
              <Link to="/watched-movies" className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/watched-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}>
                Assistidos
              </Link>
            </li>
            <li>
              <Link to="/to-watch-movies" className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/to-watch-movies') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}>
                Ver Depois
              </Link>
            </li>
            <li>
              <Link to="/genres" className={`text-[#bd0003] hover:text-gray-300 ${isActiveLink('/genres') ? 'border-2 border-[#bd0003] text-white' : ''} px-2 py-1 rounded-full`}>
                Gêneros
              </Link>
            </li>
          </ul>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                if (!searchQuery.trim()) {
                  setSearchOpen(false);
                }
              }}
              ref={searchInputRef}
              className="w-48 px-4 py-2 rounded-full bg-neutral-800 text-white placeholder-white focus:outline-none focus:ring-2 focus:ring-[#bd0003]"
              placeholder="Pesquisar"
            />
            <button onClick={() => navigate(`/search-results?query=${searchQuery}`)} className="absolute right-2 top-2 text-[#bd0003]">
              <FaSearch size={20} />
            </button>
          </div>
        </div>
        {searchQuery && searchResults.length > 0 && (
          <div className="absolute bg-black bg-opacity-80 w-full mt-2 rounded-lg max-h-96 overflow-y-auto z-50">
            <ul className="p-2">
              {loading ? (
                <li className="text-white">Carregando...</li>
              ) : (
                searchResults.map((movie) => (
                  <li key={movie.id} className="text-[#bd0003] hover:text-gray-300 py-2 px-4">
                    <Link to={`/movie/${movie.id}`}>{movie.title}</Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const toggleSearch = () => setSearchOpen(!searchOpen);

  return (
    <nav className="bg-black text-white py-4 px-6 transition-all ease-in-out duration-300">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="text-3xl font-bold text-[#bd0003] transition-colors duration-300 hover:text-white"
          style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold' }}
        >
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:hidden flex items-center">
          <button onClick={toggleSearch} className="text-white mr-4 transition-transform duration-300 hover:scale-110">
            {searchOpen ? <FaTimes size={25} /> : <FaBars size={30} />}
          </button>
          {searchOpen && (
            <input
              type="text"
              placeholder="Buscar filme..."
              className="text-black p-2 rounded-md w-40 transition-all duration-300"
            />
          )}
        </div>
        <div className="md:flex hidden items-center space-x-6">
          <ul className="flex space-x-6 items-center transition-all ease-in-out duration-300">
            {['Em Cartaz', 'Populares', 'Alta Avaliação', 'Em Breve', 'Ver Depois', 'Assistidos', 'Gêneros'].map((text, index) => (
              <li key={index} className="relative group">
                <Link
                  to={`/${text.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-[#bd0003] hover:text-white transition-all duration-300 group-hover:text-white px-4 py-2 rounded-lg"
                >
                  {text}
                </Link>
                <span className="absolute inset-0 bg-[#bd0003] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
              </li>
            ))}
          </ul>
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar filme..."
              className="text-black p-2 rounded-md w-64 transition-all duration-300"
            />
          </div>
        </div>
      </div>
      <div className={`md:hidden ${menuOpen ? 'block' : 'hidden'} transition-all duration-300`}>
        <ul className="flex flex-col items-center space-y-4 bg-black p-4 mt-4 rounded-md shadow-md">
          {['Em Cartaz', 'Populares', 'Alta Avaliação', 'Em Breve', 'Ver Depois', 'Assistidos', 'Gêneros'].map((text, index) => (
            <li key={index} className="w-full">
              <Link
                to={`/${text.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-[#bd0003] hover:text-white transition-all duration-300 w-full text-center py-2 rounded-lg"
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

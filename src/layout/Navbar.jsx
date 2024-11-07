import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);

  return (
    <nav className="bg-black text-white py-4 px-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-3xl font-bold text-red-500" style={{ fontFamily: 'Verdana, sans-serif', fontWeight: 'bold' }}>
          Tela<span className="text-white">Viva</span>
        </Link>
        <div className="md:hidden">
          <button onClick={toggleMenu} className="text-white">
            {menuOpen ? <FaTimes size={30} /> : <FaBars size={30} />}
          </button>
        </div>
        <ul className={`md:flex space-x-4 items-center md:flex-row ${menuOpen ? 'block' : 'hidden'} md:block`}>
          <li>
            <Link to="/" className="text-red-500 hover:text-gray-300">Home</Link>
          </li>
          <li>
            <Link to="/genres" className="text-red-500 hover:text-gray-300">Gêneros</Link>
          </li>
          <li>
            <Link to="/watched-movies" className="text-red-500 hover:text-gray-300">Filmes Assistidos</Link>
          </li>
          <li>
            <Link to="/to-watch-movies" className="text-red-500 hover:text-gray-300">Filmes para Ver Depois</Link>
          </li>
          <li>
            <Link to="/popular-movies" className="text-red-500 hover:text-gray-300">Filmes Populares</Link>
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
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

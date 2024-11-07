import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <nav className="bg-black px-6 py-4">
      <div className="flex justify-between items-center">
        <div className="text-2xl font-bold">
          <span className="text-[#bd0003]">Tela</span>
          <span className="text-white">Viva</span>
        </div>
        <div className="lg:hidden">
          <button onClick={toggleMenu}>
            {isOpen ? <FaTimes className="text-[#bd0003]" size={30} /> : <FaBars className="text-[#bd0003]" size={30} />}
          </button>
        </div>
        <ul className={`lg:flex space-x-6 ${isOpen ? 'block' : 'hidden'} lg:block`}>
          <li><Link to="/" className="text-[#bd0003] hover:text-gray-300">Home</Link></li>
          <li><Link to="/genres" className="text-[#bd0003] hover:text-gray-300">Gêneros</Link></li>
          <li><Link to="/watched-movies" className="text-[#bd0003] hover:text-gray-300">Filmes Assistidos</Link></li>
          <li><Link to="/to-watch-movies" className="text-[#bd0003] hover:text-gray-300">Filmes para Ver Depois</Link></li>
          <li><Link to="/popular-movies" className="text-[#bd0003] hover:text-gray-300">Filmes Populares</Link></li>
          <li><Link to="/top-rated-movies" className="text-[#bd0003] hover:text-gray-300">Top Rated</Link></li>
          <li><Link to="/now-playing-movies" className="text-[#bd0003] hover:text-gray-300">Now Playing</Link></li>
          <li><Link to="/upcoming-movies" className="text-[#bd0003] hover:text-gray-300">Upcoming</Link></li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

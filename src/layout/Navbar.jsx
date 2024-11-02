import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-[#bd0003] px-36 py-4">
      <ul className="flex space-x-4">
        <li>
          <Link to="/" className="text-white hover:text-gray-300">Home</Link>
        </li>
        <li>
          <Link to="/genres" className="text-white hover:text-gray-300">Gêneros</Link>
        </li>
        <li>
          <Link to="/watched-movies" className="text-white hover:text-gray-300">Filmes Assistidos</Link>
        </li>
        <li>
          <Link to="/to-watch-movies" className="text-white hover:text-gray-300">Filmes para Ver Depois</Link>
        </li>
        <li>
          <Link to="/popular-movies" className="text-white hover:text-gray-300">Filmes Populares</Link>
        </li>
        <li>
          <Link to="/top-rated-movies" className="text-white hover:text-gray-300">Top Rated</Link>
        </li>
        <li>
          <Link to="/now-playing-movies" className="text-white hover:text-gray-300">Now Playing</Link>
        </li>
        <li>
          <Link to="/upcoming-movies" className="text-white hover:text-gray-300">Upcoming</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;

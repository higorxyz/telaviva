import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-[#bd0003] px-6 py-4 shadow-lg">
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        <div className="text-white text-2xl font-semibold">
          <Link to="/">MovieApp</Link>
        </div>
        <div className="lg:flex hidden space-x-8">
          <ul className="flex space-x-6">
            <li>
              <Link to="/" className="text-white hover:text-gray-300 transition duration-300">Home</Link>
            </li>
            <li>
              <Link to="/genres" className="text-white hover:text-gray-300 transition duration-300">Gêneros</Link>
            </li>
            <li>
              <Link to="/watched-movies" className="text-white hover:text-gray-300 transition duration-300">Filmes Assistidos</Link>
            </li>
            <li>
              <Link to="/to-watch-movies" className="text-white hover:text-gray-300 transition duration-300">Filmes para Ver Depois</Link>
            </li>
            <li>
              <Link to="/popular-movies" className="text-white hover:text-gray-300 transition duration-300">Filmes Populares</Link>
            </li>
            <li>
              <Link to="/top-rated-movies" className="text-white hover:text-gray-300 transition duration-300">Top Rated</Link>
            </li>
            <li>
              <Link to="/now-playing-movies" className="text-white hover:text-gray-300 transition duration-300">Now Playing</Link>
            </li>
            <li>
              <Link to="/upcoming-movies" className="text-white hover:text-gray-300 transition duration-300">Upcoming</Link>
            </li>
          </ul>
        </div>
        <div className="lg:hidden">
          <button className="text-white">
            <i className="fas fa-bars"></i>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

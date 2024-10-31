import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-[#bd0003] p-4">
      <ul className="flex space-x-4">
        <li>
          <Link to="/" className="text-white hover:text-gray-300">Home</Link>
        </li>
        <li>
          <Link to="/genres" className="text-white hover:text-gray-300">Gêneros</Link>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;

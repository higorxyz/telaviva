import React from 'react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#bd0003] text-white py-6">
      <div className="container mx-auto flex flex-col sm:flex-row justify-between items-center">
        <p className="text-center sm:text-left mb-4 sm:mb-0">
          &copy; {currentYear} TelaViva. Todos os direitos reservados.
        </p>
        <div className="flex space-x-6">
          <a
            href="https://github.com/Hiigorx"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-gray-300 transition-colors"
            aria-label="GitHub"
          >
            <FaGithub size={24} />
          </a>
          <a
            href="https://www.linkedin.com/in/higorbatista/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-gray-300 transition-colors"
            aria-label="LinkedIn"
          >
            <FaLinkedin size={24} />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

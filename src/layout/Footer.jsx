import React from 'react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#bd0003] text-white py-8 mt-12">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-center sm:text-left">
            <p className="text-lg font-semibold mb-2">TelaViva</p>
            <p className="text-sm">© {currentYear} TelaViva. Todos os direitos reservados.</p>
          </div>
          <div className="flex space-x-6 mt-4 sm:mt-0">
            <a
              href="https://github.com/Hiigorx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-300 transition-colors transform hover:scale-110"
              aria-label="GitHub"
            >
              <FaGithub size={26} />
            </a>
            <a
              href="https://www.linkedin.com/in/higorbatista"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-gray-300 transition-colors transform hover:scale-110"
              aria-label="LinkedIn"
            >
              <FaLinkedin size={26} />
            </a>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-gray-300">
          <p>Desenvolvido com 💻 por Higor Batista.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

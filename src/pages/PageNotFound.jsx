import React from 'react';
import { Link } from 'react-router-dom';
import NotFoundImage from '../images/404.png';

const PageNotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-white text-center">
      <img src={NotFoundImage} alt="Página não encontrada" className="w-1/2 md:w-1/3 lg:w-1/4 mb-8" />
      <h1 className="text-4xl font-bold mb-8">Página Não Encontrada</h1>
      
      <Link to="/" className="bg-[#bd0003] text-white px-4 py-2 rounded hover:bg-[#a60002] transition-colors">
        Voltar para a Página Inicial
      </Link>
    </div>
  );
};

export default PageNotFound;
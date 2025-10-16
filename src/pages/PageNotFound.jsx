import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const PageNotFound = () => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-neutral-950 text-white text-center px-4">
      {!imageError ? (
        <img 
          src={require('../images/404.png')} 
          alt="Página não encontrada" 
          className="w-1/2 md:w-1/3 lg:w-1/4 mb-8"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="text-9xl font-bold text-[#bd0003] mb-8">404</div>
      )}
      <h1 className="text-4xl font-bold mb-4">Página Não Encontrada</h1>
      <p className="text-gray-400 mb-8 max-w-md">
        Desculpe, a página que você está procurando não existe ou foi movida.
      </p>
      <Link to="/" className="bg-[#bd0003] text-white px-6 py-3 rounded-lg hover:bg-[#a60002] transition-colors">
        Voltar para a Página Inicial
      </Link>
    </div>
  );
};

export default PageNotFound;
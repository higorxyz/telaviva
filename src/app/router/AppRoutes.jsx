import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { routesConfig } from './routesConfig';

const AppRoutes = () => (
  <Routes>
    {routesConfig.map(({ path, element }) => (
      <Route key={path} path={path} element={element} />
    ))}
  </Routes>
);

export default AppRoutes;



import React from 'react';
import Navbar from '../../components/navigation/Navbar';
import Footer from '../../components/layout/Footer';
import AppRoutes from '../router/AppRoutes';

const AppLayout = () => (
  <>
    <Navbar />
    <AppRoutes />
    <Footer />
  </>
);

export default AppLayout;



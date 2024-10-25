import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import MovieDetails from './pages/MovieDetails';
import Navbar from './layout/Navbar';
import Genres from './pages/Genres';
import Category from './pages/Category';

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/movie/:id" element={<MovieDetails />} />
        <Route path="/genres" element={<Genres />} />
        <Route path="/category/:category" element={<Category />} />
      </Routes>
    </Router>
  );
};

export default App;

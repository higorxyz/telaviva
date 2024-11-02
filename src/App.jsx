import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import MovieDetails from './pages/MovieDetails';
import Navbar from './layout/Navbar';
import Genres from './pages/Genres';
import Category from './pages/Category';
import PopularMovies from './pages/PopularMovies';
import TopRatedMovies from './pages/TopRatedMovies';
import NowPlayingMovies from './pages/NowPlayingMovies';
import UpcomingMovies from './pages/UpcomingMovies';
import WatchedMovies from './pages/WatchedMovies';
import ToWatchMovies from './pages/ToWatchMovies';

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<div className="px-28"><Home /></div>} />
        <Route path="/movie/:id" element={<MovieDetails />} />
        <Route path="/genres" element={<div className="px-28"><Genres /></div>} />
        <Route path="/category/:category" element={<div className="px-28"><Category /></div>} />
        <Route path="/popular-movies" element={<div className="px-28"><PopularMovies /></div>} />
        <Route path="/top-rated-movies" element={<div className="px-28"><TopRatedMovies /></div>} />
        <Route path="/now-playing-movies" element={<div className="px-28"><NowPlayingMovies /></div>} />
        <Route path="/upcoming-movies" element={<div className="px-28"><UpcomingMovies /></div>} />
        <Route path="/watched-movies" element={<div className="px-28"><WatchedMovies /></div>} />
        <Route path="/to-watch-movies" element={<div className="px-28"><ToWatchMovies /></div>} />
      </Routes>
    </Router>
  );
};

export default App;

import React from 'react';

const MovieCardSkeleton = () => (
  <div className="h-[400px] w-full bg-neutral-800 rounded-lg shadow-lg overflow-hidden animate-pulse">
    <div className="h-[250px] w-full bg-neutral-700" />
    <div className="p-4 space-y-4">
      <div className="h-6 w-3/4 bg-neutral-700 rounded" />
      <div className="h-4 w-1/2 bg-neutral-700 rounded" />
    </div>
  </div>
);

export default MovieCardSkeleton;
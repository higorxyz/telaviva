import React from 'react';

const ErrorMessage = ({ message }) => (
  <div className="flex items-center justify-center min-h-screen bg-neutral-950">
    <h2 className="text-white">{message}</h2>
  </div>
);

export default ErrorMessage;

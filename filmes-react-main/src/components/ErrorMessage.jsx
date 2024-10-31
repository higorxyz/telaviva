import React from 'react';

const ErrorMessage = ({ message }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-900">
    <h2 className="text-white">{message}</h2>
  </div>
);

export default ErrorMessage;

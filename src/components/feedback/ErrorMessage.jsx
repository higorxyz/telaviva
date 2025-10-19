import React from 'react';

const ErrorMessage = ({ message, retryLabel, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-surface text-body space-y-4 px-6 text-center">
    <h2 className="text-2xl font-semibold">{message}</h2>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="bg-tv-accent text-white py-2 px-4 rounded hover:bg-tv-accent-hover transition-colors focus-visible:outline-tv-accent"
      >
        {retryLabel ?? 'Tentar novamente'}
      </button>
    ) : null}
  </div>
);

export default ErrorMessage;



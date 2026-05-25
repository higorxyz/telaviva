import React from 'react';

const ErrorMessage = ({ message, retryLabel, onRetry }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-surface text-body space-y-4 px-6 text-center">
    <h2 className="text-2xl font-semibold">{message}</h2>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="btn-minimal-rect rounded-lg px-4 py-2 text-sm font-semibold"
      >
        {retryLabel ?? 'Tentar novamente'}
      </button>
    ) : null}
  </div>
);

export default ErrorMessage;



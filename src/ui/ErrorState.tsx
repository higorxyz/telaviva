'use client';

import { Button } from './Button';

export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não foi possível carregar este conteúdo agora.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-16 text-center">
      <h2 className="font-display text-3xl text-ivory">{title}</h2>
      <p className="max-w-md text-ivory-muted">{description}</p>
      {onRetry ? (
        <Button variant="primary" onClick={onRetry} className="mt-2">
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

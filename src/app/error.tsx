'use client';

import { AccentTitle } from '@/ui/AccentTitle';
import { Button } from '@/ui/Button';
import { RecoveryLinks } from '@/ui/RecoveryLinks';

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 pt-28 text-center">
      <AccentTitle as="h1" lead="Falha na" accent="projeção" className="text-5xl md:text-7xl" />
      <p className="max-w-md text-ivory-muted">Não foi possível carregar este conteúdo agora.</p>
      <Button variant="primary" onClick={retry} className="mt-2">
        Tentar novamente
      </Button>
      <RecoveryLinks />
    </div>
  );
}

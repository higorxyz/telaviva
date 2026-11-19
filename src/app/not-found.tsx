import type { Metadata } from 'next';
import { AccentTitle } from '@/ui/AccentTitle';
import { RecoveryLinks } from '@/ui/RecoveryLinks';

export const metadata: Metadata = {
  title: 'Página não encontrada',
  description: 'Não encontramos o que você procurava no TelaViva.',
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 pt-28 text-center">
      <AccentTitle as="h1" lead="Cena" accent="perdida" className="text-6xl md:text-8xl" />
      <p className="max-w-md text-ivory-muted">
        Não encontramos o que você procurava. A página pode ter saído de cartaz.
      </p>
      <RecoveryLinks primary={{ href: '/', label: 'Voltar ao início' }} />
    </div>
  );
}

import type { Metadata } from 'next';
import { RetryButton } from '@/features/offline/RetryButton';
import { pageMeta } from '@/features/share/page-meta';
import { AccentTitle } from '@/ui/AccentTitle';
import { RecoveryLinks } from '@/ui/RecoveryLinks';

export const metadata: Metadata = pageMeta({
  title: 'Sem conexão',
  description: 'Você está sem internet e esta página ainda não foi salva neste aparelho.',
  path: '/~offline',
  noindex: true,
});

/** Shown by the service worker for a page that was never saved, opened without internet. No TMDb data: always works. */
export default function OfflinePage() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 pt-28 text-center">
      <AccentTitle as="h1" lead="Sem" accent="conexão" className="text-6xl md:text-8xl" />
      <p className="max-w-md text-ivory-muted">
        Você está sem internet e esta página ainda não foi salva neste aparelho.
      </p>
      <div className="mt-2">
        <RetryButton />
      </div>
      <RecoveryLinks
        shortcuts={[
          { href: '/minha-lista', label: 'Minha lista' },
          { href: '/', label: 'Início' },
        ]}
      />
    </div>
  );
}

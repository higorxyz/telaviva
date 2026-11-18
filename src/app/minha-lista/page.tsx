import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { EmptyState } from '@/ui/EmptyState';

export const metadata: Metadata = pageMeta({
  title: 'Minha lista',
  description: 'Sua lista de filmes e séries para assistir, em breve no TelaViva.',
  path: '/minha-lista',
});

export default function MinhaListaPage() {
  return (
    <div className="pt-24">
      <EmptyState title="Em breve" description="Sua lista de filmes e séries chega na próxima fase." />
    </div>
  );
}

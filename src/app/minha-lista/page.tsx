import type { Metadata } from 'next';
import { PageHeader } from '@/features/catalog/PageHeader';
import { pageMeta } from '@/features/share/page-meta';
import { EmptyState } from '@/ui/EmptyState';
import { PAGE_CONTAINER } from '@/ui/container';

export const metadata: Metadata = pageMeta({
  title: 'Minha lista',
  description: 'Sua lista de filmes e séries para assistir, em breve no TelaViva.',
  path: '/minha-lista',
});

export default function MinhaListaPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader title={{ lead: 'Minha', accent: 'lista' }} />
      <EmptyState title="Em breve" description="Sua lista de filmes e séries chega na próxima fase." />
    </div>
  );
}

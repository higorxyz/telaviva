import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/features/catalog/PageHeader';
import { LibrarySkeleton, LibraryView } from '@/features/library/view/LibraryView';
import { pageMeta } from '@/features/share/page-meta';
import { PAGE_CONTAINER } from '@/ui/container';

export const metadata: Metadata = pageMeta({
  title: 'Minha lista',
  description: 'Sua lista de filmes e séries: quero ver, assistindo e assistidos.',
  path: '/minha-lista',
});

export default function MinhaListaPage() {
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader title={{ lead: 'Minha', accent: 'lista' }} />
      <Suspense fallback={<LibrarySkeleton />}>
        <LibraryView />
      </Suspense>
    </div>
  );
}

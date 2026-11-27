import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { PageHeader } from '@/features/catalog/PageHeader';
import { GenreTabs } from '@/features/genres/GenreTabs';
import { loadGenreCards } from '@/features/genres/load-cards';
import { PAGE_CONTAINER } from '@/ui/container';

const title = 'Gêneros';
const description = 'Explore filmes e séries por gênero: ação, drama, comédia, ficção científica e muito mais.';

export const metadata: Metadata = pageMeta({ title, description, path: '/generos' });

export default async function GenerosPage() {
  const [movie, tv] = await Promise.all([loadGenreCards('movie'), loadGenreCards('tv')]);
  return (
    <div className={`${PAGE_CONTAINER} pt-28 pb-14 md:pt-32`}>
      <PageHeader title={{ lead: 'Todos os', accent: 'gêneros' }} description="Escolha um gênero e veja os títulos mais populares." />
      <GenreTabs movie={movie} tv={tv} />
    </div>
  );
}

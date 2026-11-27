import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { notFound } from 'next/navigation';
import { ListPage, listIdsOf, listMeta } from '@/features/catalog/ListPage';

export function generateStaticParams() {
  return listIdsOf('filmes').map((lista) => ({ lista }));
}

export async function generateMetadata({ params }: PageProps<'/filmes/[lista]'>): Promise<Metadata> {
  const { lista } = await params;
  const meta = listMeta('filmes', lista);
  if (!meta) notFound();
  const title = [meta.title.lead, meta.title.accent].filter(Boolean).join(' ');
  return pageMeta({ title, description: meta.description, path: `/filmes/${lista}` });
}

export default async function Page({ params }: PageProps<'/filmes/[lista]'>) {
  const { lista } = await params;
  return <ListPage kind="filmes" lista={lista} />;
}

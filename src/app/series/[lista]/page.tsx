import type { Metadata } from 'next';
import { pageMeta } from '@/features/share/page-meta';
import { notFound } from 'next/navigation';
import { ListPage, listIdsOf, listMeta } from '@/features/catalog/ListPage';

export function generateStaticParams() {
  return listIdsOf('series').map((lista) => ({ lista }));
}

export async function generateMetadata({ params }: PageProps<'/series/[lista]'>): Promise<Metadata> {
  const { lista } = await params;
  const meta = listMeta('series', lista);
  if (!meta) notFound();
  const title = [meta.title.lead, meta.title.accent].filter(Boolean).join(' ');
  return pageMeta({ title, description: meta.description, path: `/series/${lista}` });
}

export default async function Page({ params }: PageProps<'/series/[lista]'>) {
  const { lista } = await params;
  return <ListPage kind="series" lista={lista} />;
}

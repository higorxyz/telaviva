import type { Metadata } from 'next';

type Title = string | { absolute: string };

/** Standard metadata for static pages: title, description, canonical and a `website` Open Graph block. */
export function pageMeta(args: { title: Title; description: string; path: string; noindex?: boolean }): Metadata {
  const { title, description, path, noindex } = args;
  const ogTitle = typeof title === 'string' ? title : title.absolute;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'TelaViva', locale: 'pt_BR', title: ogTitle, description, url: path },
    ...(noindex ? { robots: { index: false } } : {}),
  };
}

import type { Metadata } from 'next';

/** Next replaces `openGraph` wholesale, so every page spreads this to keep site name and locale. */
export const OG_BASE = { siteName: 'TelaViva', locale: 'pt_BR' } as const;

type Title = string | { absolute: string };

/** Standard metadata for static pages: title, description, canonical and a `website` Open Graph block. */
export function pageMeta(args: { title: Title; description: string; path: string; noindex?: boolean }): Metadata {
  const { title, description, path, noindex } = args;
  const ogTitle = typeof title === 'string' ? title : title.absolute;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', ...OG_BASE, title: ogTitle, description, url: path },
    ...(noindex ? { robots: { index: false } } : {}),
  };
}

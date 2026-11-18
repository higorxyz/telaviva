import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';
import { Rail } from '@/features/catalog/Rail';
import { ClampedText } from '@/features/detail/ClampedText';
import { DetailSection } from '@/features/detail/DetailSection';
import { personFacts } from '@/features/detail/facts';
import { FactsList } from '@/features/detail/FactsList';
import { Filmography } from '@/features/detail/Filmography';
import { loadByIdSlug, loadCanonicalPage } from '@/features/detail/load-canonical';
import { age, knownFor, toFilmRows } from '@/features/detail/person';
import { PersonHero } from '@/features/detail/PersonHero';
import { truncateSummary } from '@/features/detail/summary';
import { getPerson } from '@/features/tmdb/people';
import { personHref } from '@/lib/slug';
import { saoPauloIsoDate } from '@/features/tmdb/dates';
import { OG_BASE } from '@/features/share/page-meta';
import { PAGE_CONTAINER } from '@/ui/container';

type Props = PageProps<'/pessoa/[slug]'>;

/** Prerenders one person; every other id renders on demand. */
export function generateStaticParams() {
  return [{ slug: '287-brad-pitt' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const person = await loadByIdSlug(slug, 'pessoa', getPerson);
  const canonical = personHref(person);
  const description = truncateSummary(person.biography) || undefined;
  return {
    title: person.name,
    description,
    alternates: { canonical },
    openGraph: {
      ...OG_BASE,
      type: 'profile',
      title: person.name,
      description,
      url: canonical,
    },
  };
}

/** The clock is read inside a cache scope so the prerendered person does not depend on the request time. */
async function agesToday(birthday: string | null, deathday: string | null) {
  'use cache';
  cacheLife('days');
  if (!birthday) return { now: null, atDeath: null };
  return deathday
    ? { now: null, atDeath: age(birthday, deathday) }
    : { now: age(birthday, null, new Date(`${saoPauloIsoDate()}T12:00:00Z`)), atDeath: null };
}

export default async function PessoaPage({ params }: Props) {
  const person = await loadCanonicalPage({
    params,
    kind: 'pessoa',
    load: getPerson,
    hrefOf: personHref,
  });
  const ages = await agesToday(person.birthday, person.deathday);
  const facts = personFacts(person, ages);
  const famous = knownFor(person.credits);

  return (
    <div className={`${PAGE_CONTAINER} space-y-12 py-10 md:py-14`}>
      <PersonHero person={person}>
        {facts.length > 0 ? <FactsList facts={facts} /> : null}
        {person.biography.trim() ? (
          <DetailSection id="biografia" title={{ lead: 'Biografia' }}>
            <ClampedText text={person.biography} lines={8} preserveLineBreaks />
          </DetailSection>
        ) : null}
      </PersonHero>
      {famous.length > 0 ? <Rail id="conhecido-por" title={{ lead: 'Conhecido', accent: 'por' }} items={famous} /> : null}
      {person.credits.length > 0 ? (
        <DetailSection id="filmografia" title={{ lead: 'Filmografia' }}>
          <Filmography rows={toFilmRows(person.credits)} />
        </DetailSection>
      ) : null}
    </div>
  );
}

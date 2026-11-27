import type { ReactNode } from 'react';
import { tmdbImage } from '@/features/tmdb/images';
import type { PersonDetails } from '@/features/tmdb/types';
import { initials } from '@/lib/people';
import { BackButton } from './BackButton';
import { AccentTitle } from '@/ui/AccentTitle';
import { EagerImage } from '@/ui/EagerImage';

export function PersonPhoto({ person }: { person: Pick<PersonDetails, 'name' | 'profilePath'> }) {
  const src = tmdbImage(person.profilePath, 'h632');
  return (
    <div className="aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-poster outline outline-2 outline-offset-4 outline-amber/50 sm:w-52 md:w-64">
      {src ? (
        <EagerImage src={src} alt={`Foto de ${person.name}`} width={421} height={632} decoding="async" className="size-full object-cover" />
      ) : (
        <div data-testid="photo-placeholder" className="grid size-full place-items-center">
          <span aria-hidden="true" className="font-display text-5xl text-ivory-muted">
            {initials(person.name)}
          </span>
          <span className="sr-only">Sem foto de {person.name}</span>
        </div>
      )}
    </div>
  );
}

/** Photo beside the name; `children` carries the facts and the biography. */
export function PersonHero({ person, children }: { person: PersonDetails; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/" className="mt-8 md:mt-4" />
      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        <div className="mx-auto md:mx-0">
          <PersonPhoto person={person} />
        </div>
        <div className="min-w-0 flex-1 space-y-6">
          <AccentTitle as="h1" text={person.name} className="text-4xl sm:text-5xl lg:text-6xl" />
          {children}
        </div>
      </div>
    </div>
  );
}

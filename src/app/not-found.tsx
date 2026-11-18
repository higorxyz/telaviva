import Link from 'next/link';
import { AccentTitle } from '@/ui/AccentTitle';
import { ButtonLink } from '@/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-4 pt-24 text-center">
      <AccentTitle as="h1" lead="Cena" accent="perdida" className="text-6xl md:text-8xl" />
      <p className="max-w-md text-ivory-muted">
        Não encontramos o que você procurava. A página pode ter saído de cartaz.
      </p>
      <div className="mt-2 flex items-center gap-4">
        <ButtonLink href="/" variant="primary">
          Voltar ao início
        </ButtonLink>
        <Link href="/buscar" className="text-ivory-muted underline-offset-4 hover:text-ivory hover:underline">
          Buscar
        </Link>
      </div>
    </div>
  );
}

import Link from 'next/link';

export function QuickActions({ year }: { year: number }) {
  const actions = [
    { title: 'Noite curta', text: 'Filmes de até 100 minutos que valem a sessão.', href: '/descobrir?duracao=100&votos=100' },
    { title: 'Nota alta validada', text: 'Nota 8+ com mais de mil votos.', href: '/descobrir?nota=8&votos=1000&ordem=nota' },
    { title: 'Streaming no Brasil', text: 'O que dá para ver agora, sem sair de casa.', href: '/filmes/no-streaming' },
    { title: `Lançamentos ${year}`, text: 'Tudo o que estreou neste ano.', href: `/descobrir?de=${year}&ate=${year}` },
  ];
  return (
    <section aria-label="Atalhos rápidos">
      <h2 className="sr-only">Atalhos rápidos</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <li key={a.title}>
            <Link
              href={a.href}
              className="group block h-full rounded-lg border border-ink-600 bg-ink-900 p-5 transition-colors hover:border-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              <span className="font-display text-2xl text-ivory group-hover:text-amber">{a.title}</span>
              <span className="mt-2 block font-sans text-sm text-ivory-muted">{a.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

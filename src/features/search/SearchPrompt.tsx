/** The idle search screen's heading: in SearchView and in /buscar's loading state, which must have the same height. */
export function SearchPrompt() {
  return (
    <>
      <h2 className="font-display text-3xl text-ivory">Comece a digitar</h2>
      <p className="mt-2 text-ivory-muted">Filmes, séries e pessoas, com no mínimo 2 letras.</p>
    </>
  );
}

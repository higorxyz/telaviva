import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import type { LibraryTab } from './library-query';

const COPY: Record<LibraryTab, { title: string; description: string }> = {
  assistindo: {
    title: 'Nenhuma série em andamento',
    description: 'Marque episódios na página de uma série e ela aparece aqui, com o próximo a assistir.',
  },
  'quero-ver': {
    title: 'Sua lista está vazia',
    description: 'Adicione filmes e séries com o + nos pôsteres e eles ficam guardados aqui.',
  },
  assistidos: {
    title: 'Nada assistido ainda',
    description: 'Tudo que você marcar como assistido fica aqui, com a sua nota.',
  },
};

export function LibraryEmpty({ tab }: { tab: LibraryTab }) {
  return (
    <EmptyState
      {...COPY[tab]}
      action={
        <ButtonLink href="/descobrir" variant="primary">
          Descobrir
        </ButtonLink>
      }
    />
  );
}

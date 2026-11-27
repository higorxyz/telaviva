import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SearchPaletteLauncher } from './SearchPaletteLauncher';
import { SearchTrigger } from './SearchTrigger';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SearchTrigger />
      <SearchPaletteLauncher />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const combo = () => screen.findByRole('combobox', { name: 'Buscar filmes, séries e pessoas' });

describe('SearchPaletteLauncher', () => {
  it('renders nothing until the palette is first requested', () => {
    setup();
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('Ctrl+K loads the palette and opens it focused', async () => {
    const user = setup();
    await user.keyboard('{Control>}k{/Control}');
    expect(await combo()).toHaveFocus();
  });

  it('the header trigger loads and opens it too', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Buscar/ }));
    expect(await combo()).toBeInTheDocument();
  });
});

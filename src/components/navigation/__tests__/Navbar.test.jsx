import React from 'react';
import { screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import renderWithProviders from '../../../test-utils/renderWithProviders';
import Navbar from '../Navbar';
import { API_BASE_URL, rest, server } from '../../../test-utils/server';

jest.mock('../../../hooks/useDebouncedValue', () => ({
  __esModule: true,
  default: (value) => value,
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Navbar', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('exibe dica quando o usuário ainda não digitou caracteres suficientes', async () => {
    renderWithProviders(<Navbar />);

    const openSearchButtons = screen.getAllByRole('button', { name: /abrir pesquisa/i });
    const openSearchButton = openSearchButtons[openSearchButtons.length - 1];

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.click(openSearchButton);
    });

    const searchInput = await screen.findByPlaceholderText(/pesquisar filmes/i);

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.type(searchInput, 'M');
    });

    const helperMessages = await screen.findAllByText(/digite ao menos 2 caracteres para buscar/i);
    expect(helperMessages.length).toBeGreaterThan(0);
  });

  it('exibe sugestões de busca e permite navegar para resultados completos', async () => {
    renderWithProviders(<Navbar />);

    const openSearchButtons = screen.getAllByRole('button', { name: /abrir pesquisa/i });
    const openSearchButton = openSearchButtons[openSearchButtons.length - 1];
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.click(openSearchButton);
    });

    const searchInput = await screen.findByPlaceholderText(/pesquisar filmes/i);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.type(searchInput, 'Matrix');
    });

    const viewAllButtons = await screen.findAllByRole('button', {
      name: /ver todos os 6 resultados/i,
    });
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.click(viewAllButtons[0]);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/search-results?query=Matrix');
    });
  });

  it('destaca o termo pesquisado no título dos resultados rápidos', async () => {
    renderWithProviders(<Navbar />);

    const openSearchButtons = screen.getAllByRole('button', { name: /abrir pesquisa/i });
    const openSearchButton = openSearchButtons[openSearchButtons.length - 1];

    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.click(openSearchButton);
    });

    const searchInput = await screen.findByPlaceholderText(/pesquisar filmes/i);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.type(searchInput, 'Matrix');
    });

    const highlightedMatches = await screen.findAllByText(/matrix/i, { selector: 'mark' });
    expect(highlightedMatches.length).toBeGreaterThan(0);
  });

  it('informa quando não há resultados disponíveis', async () => {
    server.use(
      rest.get(`${API_BASE_URL}/search/movie`, (req, res, ctx) =>
        res(
          ctx.status(200),
          ctx.json({
            page: 1,
            total_pages: 1,
            total_results: 0,
            results: [],
          })
        )
      )
    );

    renderWithProviders(<Navbar />);

    const openSearchButtons = screen.getAllByRole('button', { name: /abrir pesquisa/i });
    const openSearchButton = openSearchButtons[openSearchButtons.length - 1];
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.click(openSearchButton);
    });

    const searchInput = await screen.findByPlaceholderText(/pesquisar filmes/i);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.type(searchInput, 'Avatar');
    });

    const emptyMessages = await screen.findAllByText(/nenhum resultado encontrado/i);
    expect(emptyMessages.length).toBeGreaterThan(0);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

});

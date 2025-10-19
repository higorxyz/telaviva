import React from 'react';
import { screen, act } from '@testing-library/react';
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

  it('exibe sugestões de busca e permite navegar para resultados completos', async () => {
    renderWithProviders(<Navbar />);

    const [searchInput] = screen.getAllByPlaceholderText(/pesquisar/i);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.type(searchInput, 'Matrix');
    });

    const suggestions = await screen.findAllByText('Matrix Resurrections');
    expect(suggestions[0]).toBeInTheDocument();

    const viewAllButtons = await screen.findAllByRole('button', {
      name: /ver todos os 6 resultados/i,
    });
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.click(viewAllButtons[0]);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/search-results?query=Matrix');
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

    const [searchInput] = screen.getAllByPlaceholderText(/pesquisar/i);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      await userEvent.type(searchInput, 'Avatar');
    });

    const emptyMessages = await screen.findAllByText(/nenhum resultado encontrado/i);
    expect(emptyMessages.length).toBeGreaterThan(0);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

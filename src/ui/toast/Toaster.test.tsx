import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';

type ShowArg = Parameters<ReturnType<typeof useToast>['show']>[0];

function Trigger({ toast }: { toast: ShowArg }) {
  const { show } = useToast();
  return (
    <button type="button" onClick={() => show(toast)}>
      abrir
    </button>
  );
}

function setup(toast: ShowArg = { message: 'Salvo em Quero ver' }) {
  render(
    <ToastProvider>
      <Trigger toast={toast} />
    </ToastProvider>,
  );
  const open = () => fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
  return { open };
}

describe('Toaster', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('has a polite live region that holds the message', () => {
    const { open } = setup();
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    open();
    expect(region).toHaveTextContent('Salvo em Quero ver');
  });

  it('dismisses itself after 5 seconds', () => {
    const { open } = setup();
    open();
    act(() => vi.advanceTimersByTime(4900));
    expect(screen.getByText('Salvo em Quero ver')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText('Salvo em Quero ver')).not.toBeInTheDocument();
  });

  it('pauses while hovered and resumes afterwards', () => {
    const { open } = setup();
    open();
    const toast = screen.getByText('Salvo em Quero ver').closest('[data-toast]')!;
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText('Salvo em Quero ver')).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(1900));
    expect(screen.getByText('Salvo em Quero ver')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText('Salvo em Quero ver')).not.toBeInTheDocument();
  });

  it('pauses while focus is inside', () => {
    const { open } = setup();
    open();
    const close = screen.getByRole('button', { name: 'Fechar aviso' });
    fireEvent.focus(close);
    act(() => vi.advanceTimersByTime(20_000));
    expect(screen.getByText('Salvo em Quero ver')).toBeInTheDocument();
    fireEvent.blur(close);
    act(() => vi.advanceTimersByTime(5100));
    expect(screen.queryByText('Salvo em Quero ver')).not.toBeInTheDocument();
  });

  it('closes with the close button', () => {
    const { open } = setup();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByText('Salvo em Quero ver')).not.toBeInTheDocument();
  });

  it('runs the action and closes the toast', () => {
    const onClick = vi.fn();
    const { open } = setup({ message: 'Removido da sua lista', action: { label: 'Desfazer', onClick } });
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Removido da sua lista')).not.toBeInTheDocument();
  });

  it('shows at most 3 toasts, dropping the oldest', () => {
    function Many() {
      const { show } = useToast();
      return (
        <button
          type="button"
          onClick={() => ['um', 'dois', 'tres', 'quatro'].forEach((message) => show({ message }))}
        >
          abrir
        </button>
      );
    }
    render(
      <ToastProvider>
        <Many />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'abrir' }));
    expect(screen.queryByText('um')).not.toBeInTheDocument();
    expect(screen.getByText('dois')).toBeInTheDocument();
    expect(screen.getByText('tres')).toBeInTheDocument();
    expect(screen.getByText('quatro')).toBeInTheDocument();
  });

  it('gives both buttons the amber focus-visible outline', () => {
    const { open } = setup({ message: 'Removido da sua lista', action: { label: 'Desfazer', onClick: () => {} } });
    open();
    for (const name of ['Desfazer', 'Fechar aviso']) {
      const classes = screen.getByRole('button', { name }).className.split(' ');
      expect(classes).toEqual(expect.arrayContaining(['focus-visible:outline-2', 'focus-visible:outline-amber']));
    }
  });

  it('dismissTag closes only the toasts carrying that tag', () => {
    function Tagged() {
      const { show, dismissTag } = useToast();
      return (
        <>
          <button type="button" onClick={() => show({ message: 'Desfazível', tag: 'library' })}>
            com tag
          </button>
          <button type="button" onClick={() => show({ message: 'Sessão' })}>
            sem tag
          </button>
          <button type="button" onClick={() => dismissTag('library')}>
            limpar
          </button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Tagged />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'com tag' }));
    fireEvent.click(screen.getByRole('button', { name: 'sem tag' }));
    fireEvent.click(screen.getByRole('button', { name: 'limpar' }));
    expect(screen.queryByText('Desfazível')).not.toBeInTheDocument();
    expect(screen.getByText('Sessão')).toBeInTheDocument();
  });

  it('marks the error tone', () => {
    const { open } = setup({ message: 'Falhou', tone: 'error' });
    open();
    expect(screen.getByText('Falhou').closest('[data-toast]')).toHaveAttribute('data-tone', 'error');
  });
});

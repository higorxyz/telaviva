import { act, fireEvent, render, screen } from '@testing-library/react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { useToastDock } from '@/ui/toast/useToast';
import { resetOffline, setOffline } from './test-offline';

vi.mock('next/offline', async () => (await import('./test-offline')).offlineModule);
vi.mock('next/navigation', () => ({ usePathname: () => '/filmes' }));

import { ConnectionStatus } from './ConnectionStatus';

const OFFLINE = 'Sem conexão. Suas ações serão enviadas quando a internet voltar.';
const SYNCED = 'Tudo sincronizado.';
const PENDING = 'Esta página abre quando a internet voltar.';

/** Stands in for the e-mail confirmation card, which lives in the stack's dock. */
function DockedCard() {
  const dock = useToastDock();
  return dock ? createPortal(<p>Cartão no dock</p>, dock) : null;
}

const tree = (queued?: number) => (
  <ToastProvider>
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- stands in for next/link, which needs a router */}
    <a
      href="/series"
      onClick={(event) => {
        // What next/link does: the router takes over the navigation.
        event.preventDefault();
      }}
    >
      Séries
    </a>
    <DockedCard />
    <ConnectionStatus queued={queued} />
  </ToastProvider>
);

function setup(queued?: number) {
  const view = render(tree(queued));
  return { rerender: (next: number) => view.rerender(tree(next)) };
}

/** The indicator's own live region (the toast stack has another one, for the toasts). */
const region = () => document.querySelector<HTMLElement>('[data-connection-status]')!;

describe('ConnectionStatus', () => {
  beforeEach(() => {
    resetOffline();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('is a polite live region, present and empty while online with nothing queued', () => {
    setup();
    expect(region()).toHaveAttribute('role', 'status');
    expect(region()).toHaveAttribute('aria-live', 'polite');
    expect(region()).toBeEmptyDOMElement();
  });

  it('says the app is offline and that actions go out when the internet returns', () => {
    setup();
    setOffline(true);
    expect(region()).toHaveTextContent(OFFLINE);
    setOffline(false);
    expect(region()).toBeEmptyDOMElement();
  });

  it('counts the queued actions, singular and plural', () => {
    const { rerender } = setup(1);
    setOffline(true);
    expect(region()).toHaveTextContent('1 ação aguardando envio');
    rerender(3);
    expect(region()).toHaveTextContent('3 ações aguardando envio');
    expect(region()).toHaveTextContent(OFFLINE);
  });

  it('says "Tudo sincronizado." once when the queue empties back online, then goes away', () => {
    const { rerender } = setup(2);
    setOffline(true);
    setOffline(false);
    expect(region()).toHaveTextContent('2 ações aguardando envio');
    rerender(0);
    expect(region()).toHaveTextContent(SYNCED);
    act(() => vi.advanceTimersByTime(4900));
    expect(region()).toHaveTextContent(SYNCED);
    act(() => vi.advanceTimersByTime(200));
    expect(region()).toBeEmptyDOMElement();
    rerender(0);
    expect(region()).toBeEmptyDOMElement();
  });

  it('does not claim a sync that happened while offline', () => {
    const { rerender } = setup(1);
    setOffline(true);
    rerender(0);
    expect(region()).not.toHaveTextContent(SYNCED);
    expect(region()).toHaveTextContent(OFFLINE);
  });

  it('after 1.5 s of an in-app navigation stuck offline, says the page opens later and links to the list', () => {
    setup();
    setOffline(true);
    fireEvent.click(screen.getByRole('link', { name: 'Séries' }));
    act(() => vi.advanceTimersByTime(1499));
    expect(region()).not.toHaveTextContent(PENDING);
    act(() => vi.advanceTimersByTime(1));
    expect(region()).toHaveTextContent(PENDING);
    expect(region()).not.toHaveTextContent(OFFLINE);
    expect(screen.getByRole('link', { name: 'Ver minha lista' })).toHaveAttribute('href', '/minha-lista');
  });

  it('sits in the lowest slot of the toast stack, under the card in the dock', () => {
    setup();
    setOffline(true);
    const indicator = screen.getByText(OFFLINE);
    const card = screen.getByText('Cartão no dock');
    const stack = indicator.closest('[data-toast-stack]');
    expect(stack).not.toBeNull();
    expect(stack).toContainElement(card);
    expect(card.compareDocumentPosition(indicator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

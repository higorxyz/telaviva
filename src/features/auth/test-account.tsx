import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect } from 'vitest';
import { server } from '@/test/server';
import { DeleteAccount } from './DeleteAccount';
import type { SessionUser } from './session-client';
import { fakeAuth, fakeUser, log } from './test-firebase';
import { probe, renderAuth, signedInOnServer, url } from './test-auth';

/**
 * Shared setup for the DeleteAccount tests, which run the real AuthProvider and library against msw. Wire it in with
 * the Firebase mocks of test-firebase.ts and:
 *   vi.mock('next/navigation', async () => (await import('./test-nav')).navigationModule);
 */

export { nav } from './test-nav';

/** jsdom has no modal dialogs: open / close by attribute, and fire `close` like a browser. */
export function polyfillDialog() {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

/** Esc as a browser handles it: `cancel` first, and the dialog closes unless that was prevented. */
export function pressEscape(dialog: HTMLDialogElement): boolean {
  const event = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(event);
  if (!event.defaultPrevented) dialog.close();
  return event.defaultPrevented;
}

/**
 * Esc on a busy main thread: the browser closes the dialog (and gives the focus back) at once, but its `close` event
 * is a queued task that a key press can overtake. Returns the delivery of that late `close`.
 */
export function pressEscapeWithLateClose(dialog: HTMLDialogElement): () => void {
  dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
  dialog.removeAttribute('open');
  return () => dialog.dispatchEvent(new Event('close'));
}

type Answer ={ status: number; body?: unknown } | (() => Promise<Response>);

/** The `X-Expected-User` of each `DELETE /api/account`, in order. */
export const expectedUsers: (string | null)[] = [];

/** `DELETE /api/account` answers these in order (the last one repeats), logging each call. */
export function deleteAnswers(...answers: Answer[]) {
  let calls = 0;
  expectedUsers.length = 0;
  server.use(
    http.delete(url('/api/account'), async ({ request }) => {
      log.push('DELETE account');
      expectedUsers.push(request.headers.get('x-expected-user'));
      const answer = answers[Math.min(calls++, answers.length - 1)];
      if (typeof answer === 'function') return answer();
      return answer.body === undefined
        ? new HttpResponse(null, { status: answer.status })
        : HttpResponse.json(answer.body, { status: answer.status });
    }),
  );
}

/** Signed in as `uid` on the server and, unless `firebaseUser` is false, in Firebase's own storage too. */
export async function renderSignedIn(
  overrides: Partial<SessionUser> = {},
  { uid = 'u1', firebaseUser = true }: { uid?: string; firebaseUser?: boolean } = {},
) {
  signedInOnServer(uid, overrides);
  fakeAuth.currentUser = firebaseUser ? fakeUser(uid) : null;
  const view = renderAuth(<DeleteAccount />);
  await waitFor(() => expect(probe()).toMatch(/^signed-in/));
  return view;
}

/** Opens the dialog and types `word` into "Digite EXCLUIR". */
export async function openAndType(word = 'EXCLUIR') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
  if (word) await user.type(screen.getByLabelText('Digite EXCLUIR'), word);
  return user;
}

export const confirmButton = () => screen.getByRole('button', { name: 'Excluir para sempre' });
export const REAUTH = 'Por segurança, entre de novo para excluir a conta.';
export const DELETED = 'Conta excluída.';
export const WRONG_ACCOUNT = 'Entre com a mesma conta que você quer excluir.';
export const STALE = 'A conta aberta mudou em outra aba. Confira e tente de novo.';

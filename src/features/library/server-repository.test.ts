import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { applyCommand } from './commands';
import {
  LibraryConflictError,
  LibraryLimitError,
  LibraryRemoteError,
  LibrarySessionError,
  LibraryWrongAccountError,
  type LibraryNotice,
} from './repository';
import { createServerRepository } from './server-repository';
import { NOW, want } from './test-storage';
import { EMPTY_LIBRARY } from './types';

const url = (path: string) => `${window.location.origin}${path}`;
const saved = applyCommand(EMPTY_LIBRARY, want(1), NOW);

function setup() {
  const onUnauthenticated = vi.fn();
  const onWrongAccount = vi.fn();
  const repository = createServerRepository({ uid: 'ana', onUnauthenticated, onWrongAccount });
  const notices: LibraryNotice[] = [];
  repository.onNotice?.((n) => notices.push(n));
  return { repository, onUnauthenticated, onWrongAccount, notices };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createServerRepository', () => {
  it('is persistent and carries the account error copy', () => {
    const { repository } = setup();
    expect(repository.persistent).toBe(true);
    expect(repository.errorMessage).toBe('Não foi possível salvar na sua conta. Tente de novo.');
  });

  it('loads from GET /api/library', async () => {
    server.use(http.get(url('/api/library'), () => HttpResponse.json(saved)));
    expect(await setup().repository.load()).toEqual(saved);
  });

  it('applies a command with POST /api/library/commands and returns the new state', async () => {
    let received: { body: unknown; type: string | null } | undefined;
    server.use(
      http.post(url('/api/library/commands'), async ({ request }) => {
        received = { body: await request.json(), type: request.headers.get('content-type') };
        return HttpResponse.json(saved);
      }),
    );
    expect(await setup().repository.apply(want(1))).toEqual(saved);
    expect(received).toEqual({ body: { command: want(1) }, type: 'application/json' });
  });

  it('drops a bad row instead of failing the whole response', async () => {
    server.use(
      http.get(url('/api/library'), () => HttpResponse.json({ ...saved, items: [...saved.items, { broken: true }] })),
    );
    expect((await setup().repository.load()).items).toHaveLength(1);
  });

  it('rejects a response that is not a library', async () => {
    server.use(http.get(url('/api/library'), () => HttpResponse.json('nope')));
    await expect(setup().repository.load()).rejects.toBeInstanceOf(LibraryRemoteError);
  });

  it('calls onUnauthenticated and rejects with LibrarySessionError on 401', async () => {
    server.use(http.get(url('/api/library'), () => HttpResponse.json({ error: 'unauthenticated' }, { status: 401 })));
    const { repository, onUnauthenticated } = setup();
    await expect(repository.load()).rejects.toBeInstanceOf(LibrarySessionError);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('retries once when onUnauthenticated renewed the session for the same user', async () => {
    let calls = 0;
    server.use(
      http.post(url('/api/library/commands'), () => {
        calls++;
        return calls === 1 ? HttpResponse.json({ error: 'unauthenticated' }, { status: 401 }) : HttpResponse.json(saved);
      }),
    );
    const onUnauthenticated = vi.fn(async () => true);
    const repository = createServerRepository({ uid: 'ana', onUnauthenticated });
    expect(await repository.apply(want(1))).toEqual(saved);
    expect(calls).toBe(2);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the renewal failed, nor a second time', async () => {
    let calls = 0;
    server.use(
      http.get(url('/api/library'), () => {
        calls++;
        return HttpResponse.json({ error: 'unauthenticated' }, { status: 401 });
      }),
    );
    const failed = vi.fn(async () => false);
    await expect(createServerRepository({ uid: 'ana', onUnauthenticated: failed }).load()).rejects.toBeInstanceOf(LibrarySessionError);
    expect(calls).toBe(1);
    const renewed = vi.fn(async () => true);
    await expect(createServerRepository({ uid: 'ana', onUnauthenticated: renewed }).load()).rejects.toBeInstanceOf(LibrarySessionError);
    expect(calls).toBe(3);
    expect(renewed).toHaveBeenCalledTimes(1);
  });

  it('emits the conflict notice and rejects with LibraryConflictError on 409', async () => {
    server.use(http.post(url('/api/library/commands'), () => HttpResponse.json({ error: 'conflict' }, { status: 409 })));
    const { repository, notices } = setup();
    await expect(repository.apply(want(1))).rejects.toBeInstanceOf(LibraryConflictError);
    expect(notices).toEqual(['conflict']);
  });

  it('names the account it belongs to in X-Expected-User on every load and apply', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(url('/api/library'), ({ request }) => {
        seen.push(request.headers.get('x-expected-user'));
        return HttpResponse.json(saved);
      }),
      http.post(url('/api/library/commands'), ({ request }) => {
        seen.push(request.headers.get('x-expected-user'));
        return HttpResponse.json(saved);
      }),
    );
    const { repository } = setup();
    await repository.load();
    await repository.apply(want(1));
    expect(seen).toEqual(['ana', 'ana']);
  });

  it('on 409 wrong_account (another tab switched accounts): asks sign-in to catch up, without a conflict notice', async () => {
    server.use(http.post(url('/api/library/commands'), () => HttpResponse.json({ error: 'wrong_account' }, { status: 409 })));
    const { repository, notices, onWrongAccount } = setup();
    await expect(repository.apply(want(1))).rejects.toBeInstanceOf(LibraryWrongAccountError);
    expect(onWrongAccount).toHaveBeenCalledTimes(1);
    expect(notices).toEqual([]);
    server.use(http.get(url('/api/library'), () => HttpResponse.json({ error: 'wrong_account' }, { status: 409 })));
    await expect(repository.load()).rejects.toBeInstanceOf(LibraryWrongAccountError);
    expect(onWrongAccount).toHaveBeenCalledTimes(2);
  });

  it('emits the limit notice and rejects with LibraryLimitError on 413 limit', async () => {
    server.use(http.post(url('/api/library/commands'), () => HttpResponse.json({ error: 'limit' }, { status: 413 })));
    const { repository, notices } = setup();
    await expect(repository.apply(want(1))).rejects.toBeInstanceOf(LibraryLimitError);
    expect(notices).toEqual(['limit']);
  });

  it('treats a payload_too_large 413, a 500 and a network failure as generic remote errors', async () => {
    const { repository, notices } = setup();
    server.use(http.post(url('/api/library/commands'), () => HttpResponse.json({ error: 'payload_too_large' }, { status: 413 })));
    await expect(repository.apply(want(1))).rejects.toBeInstanceOf(LibraryRemoteError);
    server.use(http.post(url('/api/library/commands'), () => new HttpResponse(null, { status: 500 })));
    await expect(repository.apply(want(1))).rejects.toBeInstanceOf(LibraryRemoteError);
    server.use(http.post(url('/api/library/commands'), () => HttpResponse.error()));
    await expect(repository.apply(want(1))).rejects.toBeInstanceOf(LibraryRemoteError);
    expect(notices).toEqual([]);
  });

  it('delivers a notice raised before anyone listened to the first listener', async () => {
    server.use(http.post(url('/api/library/commands'), () => HttpResponse.json({ error: 'conflict' }, { status: 409 })));
    const repository = createServerRepository({ uid: 'ana', onUnauthenticated: () => {} });
    await expect(repository.apply(want(1))).rejects.toBeInstanceOf(LibraryConflictError);
    const heard: LibraryNotice[] = [];
    repository.onNotice?.((n) => heard.push(n));
    expect(heard).toEqual(['conflict']);
  });

  describe('subscribe', () => {
    function show(state: 'visible' | 'hidden') {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
      document.dispatchEvent(new Event('visibilitychange'));
    }

    it('reports a refocus at most once every 30 seconds and stops after unsubscribing', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(NOW));
      const onChange = vi.fn();
      const unsubscribe = setup().repository.subscribe(onChange);
      show('hidden');
      expect(onChange).not.toHaveBeenCalled();
      show('visible');
      expect(onChange).not.toHaveBeenCalled(); // just loaded
      vi.advanceTimersByTime(31_000);
      show('visible');
      expect(onChange).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(10_000);
      show('visible');
      expect(onChange).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(21_000);
      show('visible');
      expect(onChange).toHaveBeenCalledTimes(2);
      unsubscribe();
      vi.advanceTimersByTime(60_000);
      show('visible');
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });
});

import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { reloadQuery } from './reload-query';

const KEY = ['library'] as const;

/** A query whose loads answer only when the test says so, in order. */
function deferredLoads() {
  const pending: ((value: string) => void)[] = [];
  const load = () => new Promise<string>((resolve) => pending.push(resolve));
  return { load, answer: (index: number, value: string) => pending[index]!(value), count: () => pending.length };
}

let client: QueryClient;
let stop = () => {};

afterEach(() => {
  stop();
  client.clear();
});

function observe(load: () => Promise<string>) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const observer = new QueryObserver(client, { queryKey: KEY, queryFn: load, staleTime: Infinity });
  stop = observer.subscribe(() => {});
  return () => client.getQueryData<string>(KEY);
}

describe('reloadQuery', () => {
  it('drops a first load still in flight, which may have read the data before the change, and loads again', async () => {
    const loads = deferredLoads();
    const data = observe(loads.load);
    expect(loads.count()).toBe(1);

    const reloaded = reloadQuery(client, KEY);
    await expect.poll(loads.count).toBe(2);
    loads.answer(0, 'before the merge');
    loads.answer(1, 'after the merge');
    await reloaded;

    await expect.poll(data).toBe('after the merge');
  });

  it('is needed: invalidating alone reuses that first load, and the data from before the change stays', async () => {
    const loads = deferredLoads();
    const data = observe(loads.load);

    const invalidated = client.invalidateQueries({ queryKey: KEY });
    loads.answer(0, 'before the merge');
    await invalidated;

    expect(loads.count()).toBe(1);
    expect(data()).toBe('before the merge');
  });

  it('with data already there, loads again and keeps the data until the new answer', async () => {
    const loads = deferredLoads();
    const data = observe(loads.load);
    loads.answer(0, 'first');
    await expect.poll(data).toBe('first');

    const reloaded = reloadQuery(client, KEY);
    await expect.poll(loads.count).toBe(2);
    expect(data()).toBe('first');
    loads.answer(1, 'second');
    await reloaded;
    expect(data()).toBe('second');
  });
});

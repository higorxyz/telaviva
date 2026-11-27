import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Loads a query again after a change made elsewhere (the guest merge, a sync, another tab), dropping a load already in
 * flight: that load may have read the data before the change. `invalidateQueries` alone does not drop it while the
 * query has no data yet (TanStack Query only cancels in-flight refetches of a query that already has data): it reuses
 * that first load, which then shows the data from before the change and marks the query fresh. Right after signing up,
 * that was the list without the visitor's titles the merge had just saved.
 */
export async function reloadQuery(queryClient: QueryClient, queryKey: QueryKey): Promise<void> {
  await queryClient.cancelQueries({ queryKey });
  await queryClient.invalidateQueries({ queryKey });
}

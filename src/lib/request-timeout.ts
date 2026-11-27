/**
 * How long a browser request to the app's own API (`/api/auth/*`, `/api/library*`) may take before it counts as no
 * answer: 8 s. The offline fallbacks (the saved copy, the queue, the identity kept on the device) only start when a
 * request fails, and a connection with signal but no data (metro, plane, captive Wi-Fi) leaves `navigator.onLine`
 * true while fetch hangs for a minute or more. 8 s is well above a cold start of the function and the database
 * together, and short enough that the person still sees the saved list and that a queued action is not stuck.
 */
export const REQUEST_TIMEOUT_MS = 8_000;

/** The reason a request's signal carries when its time ran out. */
export const isTimeout = (reason: unknown) => reason instanceof DOMException && reason.name === 'TimeoutError';

export type RequestDeadline = {
  /** Aborts with a `TimeoutError` when the time runs out. */
  signal: AbortSignal;
  /** True once the time ran out. */
  readonly expired: boolean;
  /** Stops the clock (call once the response, body included, was read). */
  clear(): void;
};

/**
 * A deadline for one request. Not `AbortSignal.timeout`: that one cannot be cleared once the answer arrived, and a
 * plain timer is what tests drive with fake timers. Nothing passes a signal of its own to these requests today; one
 * that does should combine both with `AbortSignal.any`.
 */
export function requestDeadline(ms: number = REQUEST_TIMEOUT_MS): RequestDeadline {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(new DOMException('The request timed out', 'TimeoutError')), ms);
  return {
    signal: controller.signal,
    get expired() {
      return controller.signal.aborted;
    },
    clear: () => clearTimeout(id),
  };
}

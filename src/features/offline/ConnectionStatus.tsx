'use client';

import { CloudCheck, CloudUpload, WifiOff, type LucideIcon } from 'lucide-react';
import { useBrowserOffline, useIsOffline } from './useIsOffline';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useToastStatusSlot } from '@/ui/toast/useToast';
import {
  MY_LIST_LINK,
  OFFLINE_TEXT,
  PENDING_NAVIGATION_TEXT,
  queuedText,
  SYNCED_LIFETIME_MS,
  SYNCED_TEXT,
} from './copy';
import { usePendingNavigation } from './usePendingNavigation';

// The amber ring used across the app, as on the toasts above it.
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber';

/**
 * True for a while after the queue empties with the connection up: "Tudo sincronizado." once per emptying, for as long
 * as a toast stays. An emptying while the browser reports no connection (when the queue never sends, so it cannot have
 * been a sync: an undo) says nothing. `offline` is the browser's own report, not `useOffline`: after the `online`
 * event, Next keeps saying offline until its connectivity check answers, and a queue sent before that answer would
 * otherwise never be confirmed.
 */
function useSyncedNotice(queued: number, offline: boolean): boolean {
  const [last, setLast] = useState(queued);
  /** How many times the queue emptied online, and the last of those whose notice ran out. */
  const [syncs, setSyncs] = useState(0);
  const [expired, setExpired] = useState(0);
  if (queued !== last) {
    setLast(queued);
    if (last > 0 && queued === 0 && !offline) setSyncs(syncs + 1);
  }
  useEffect(() => {
    if (syncs === 0) return;
    const timer = setTimeout(() => setExpired(syncs), SYNCED_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [syncs]);
  return syncs > expired && !offline && queued === 0;
}

function Card({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl border border-ink-600 bg-ink-800 px-4 py-1 text-sm text-ivory shadow-poster">
      <Icon aria-hidden="true" className="mt-3 size-4 shrink-0 text-amber" />
      <div className="min-w-0 flex-1 py-2">{children}</div>
    </div>
  );
}

type MessageProps = { offline: boolean; pending: boolean; queued: number; synced: boolean };

function Message({ offline, pending, queued, synced }: MessageProps) {
  if (synced) {
    return (
      <Card icon={CloudCheck}>
        <p className="text-pretty">{SYNCED_TEXT}</p>
      </Card>
    );
  }
  const count = queued > 0 ? <p className="text-ivory-muted">{queuedText(queued)}</p> : null;
  if (!offline) return <Card icon={CloudUpload}>{count}</Card>;
  return (
    <Card icon={WifiOff}>
      {pending ? (
        <>
          <p className="text-pretty">{PENDING_NAVIGATION_TEXT}</p>
          {/* A full load, not next/link: the service worker answers it from the saved copy, while a router
              navigation would wait for the network like the one that is stuck. */}
          <a
            href="/minha-lista"
            className={cn(
              '-ml-2 inline-flex min-h-11 items-center rounded-xl px-2 font-medium text-amber underline underline-offset-4 hover:text-amber-strong',
              FOCUS,
            )}
          >
            {MY_LIST_LINK}
          </a>
        </>
      ) : (
        <p className="text-pretty">{OFFLINE_TEXT}</p>
      )}
      {count}
    </Card>
  );
}

/**
 * The connection indicator, at the very bottom of the toast stack (`useToastStatusSlot`), under the e-mail
 * confirmation card: fixed, so it never moves the page nor covers a title. Offline it says so (or, once an in-app
 * navigation has been stuck for 1.5 s, that the page opens when the internet returns) and counts the actions waiting
 * to be sent; it confirms when the queue empties. `queued` comes from the account's offline queue (mounted by
 * `LibraryConnectionStatus`, which reads it).
 *
 * Its live region stays in the tree, empty while there is nothing to say, so each message is announced.
 * `useIsOffline` is false on the server and during hydration, so the first paint is always empty: nothing to
 * mismatch.
 */
export function ConnectionStatus({ queued = 0 }: { queued?: number }) {
  const offline = useIsOffline();
  const pending = usePendingNavigation();
  const browserOffline = useBrowserOffline();
  const synced = useSyncedNotice(queued, browserOffline);
  const slot = useToastStatusSlot();
  if (!slot) return null;
  const visible = offline || queued > 0 || synced;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-connection-status=""
      className="flex w-full flex-col items-center md:items-end"
    >
      {visible ? <Message offline={offline} pending={pending} queued={queued} synced={synced} /> : null}
    </div>,
    slot,
  );
}

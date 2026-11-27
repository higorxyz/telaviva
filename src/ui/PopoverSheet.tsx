'use client';

import { X } from 'lucide-react';
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn } from '@/lib/cn';

const WIDE = '(min-width: 48rem)';
const PANEL_WIDTH = 416; // md:w-[26rem]

/** The selected option if there is one, else the first control of the panel body (not its header buttons). */
function firstControl(panel: HTMLElement): HTMLElement | null {
  return (
    panel.querySelector<HTMLElement>('[data-panel-body] [aria-pressed="true"], [data-panel-body] [aria-checked="true"]') ??
    panel.querySelector<HTMLElement>(
      '[data-panel-body] [tabindex="0"], [data-panel-body] button, [data-panel-body] select, [data-panel-body] input',
    )
  );
}

/** What the trigger element must spread so the panel can anchor to it and announce itself. */
export interface TriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  'aria-haspopup': 'dialog';
  'aria-expanded': boolean;
  'aria-controls': string;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onKeyDown: KeyboardEventHandler<HTMLButtonElement>;
}

export interface PopoverContext {
  /** Closes the panel and returns focus to its trigger (single-choice picks). */
  close: () => void;
  /** Id of the panel heading, for `aria-labelledby` on the panel's control group. */
  titleId: string;
  /** Moves focus to the close button (for header actions that disappear when used). */
  focusClose: () => void;
}

/**
 * A trigger plus a native <dialog>. From md up it opens non-modal under the trigger (a popover: outside click,
 * Esc, focus leaving or the close button dismiss it); on small screens it opens modal as a bottom sheet
 * (backdrop, Esc, close button). Focus moves into the panel on open and back to the trigger on close, except
 * when the user dismissed it by clicking elsewhere. Crossing md closes it.
 */
export function PopoverSheet({
  trigger,
  open,
  onOpenChange,
  title,
  headerActions,
  children,
}: {
  trigger: (props: TriggerProps) => ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Extra buttons next to the close button ("Limpar"). */
  headerActions?: (ctx: PopoverContext) => ReactNode;
  children: (ctx: PopoverContext) => ReactNode;
}) {
  const id = useId();
  const titleId = `${id}-titulo`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeId = `${id}-fechar`;
  const wasOpen = useRef(false);
  const modal = useRef(false);
  const [alignEnd, setAlignEnd] = useState(false);
  /** Whether the next close hands focus back to the trigger (not when the user clicked elsewhere). */
  const [restoreFocus, setRestoreFocus] = useState(true);

  const close = (restore = true) => {
    setRestoreFocus(restore);
    onOpenChange(false);
  };

  useLayoutEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      modal.current = !(window.matchMedia?.(WIDE).matches ?? true);
      if (modal.current) el.showModal();
      else el.show();
      firstControl(el)?.focus();
    } else if (!open) {
      if (el.open) el.close();
      if (wasOpen.current && restoreFocus) triggerRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open, restoreFocus]);

  // Leaving the route hides it in an <Activity>: the owner resets which panel is open, this closes the element.
  useLayoutEffect(() => {
    const el = dialog.current;
    const was = wasOpen;
    return () => {
      // Not "was open" any more, so coming back does not pull focus onto the trigger.
      was.current = false;
      if (el?.open) el.close();
    };
  }, []);

  const dismiss = useEffectEvent(() => close(false));
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (modal.current || dialog.current?.contains(target) || triggerRef.current?.contains(target)) return;
      dismiss();
    };
    // Crossing md swaps popover and sheet, so the panel closes rather than reflowing mid-interaction.
    const wide = window.matchMedia?.(WIDE);
    document.addEventListener('pointerdown', onPointerDown);
    wide?.addEventListener('change', dismiss);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      wide?.removeEventListener('change', dismiss);
    };
  }, [open]);

  const ctx: PopoverContext = { close: () => close(), titleId, focusClose: () => document.getElementById(closeId)?.focus() };

  return (
    <div className="relative shrink-0">
      {trigger({
        ref: triggerRef,
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': id,
        onClick: (e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setAlignEnd(box.left + PANEL_WIDTH > window.innerWidth - 16);
          if (open) close();
          else onOpenChange(true);
        },
        onKeyDown: (e) => {
          if (e.key === 'Escape' && open) close();
        },
      })}
      <dialog
        ref={dialog}
        id={id}
        aria-labelledby={titleId}
        onClose={(e) => {
          // The close event is a queued task: on a busy main thread it can come after the panel opened again (Esc,
          // then Enter on the trigger). Then it belongs to the earlier closing and must not close the new opening.
          if (open && !e.currentTarget.open) close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onKeyDown={(e) => {
          // The modal sheet gets Esc natively (cancel, then close); the non-modal popover needs it by hand.
          if (e.key === 'Escape' && !modal.current) {
            e.stopPropagation();
            close();
          }
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (!modal.current && next && !e.currentTarget.contains(next) && !triggerRef.current?.contains(next)) {
            close(false);
          }
        }}
        className={cn(
          'm-0 border border-ink-600 bg-ink-900 p-0 text-ivory shadow-poster backdrop:bg-ink-950/80 motion-reduce:animate-none',
          'max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:max-h-[85dvh] max-md:w-full max-md:max-w-none max-md:animate-sheet-in max-md:overflow-y-auto max-md:rounded-t-2xl max-md:border-x-0 max-md:border-b-0',
          // Sized to its content between 20rem and 26rem: one-row choices stay compact, chip lists wrap at 26rem.
          'md:absolute md:top-full md:mt-2 md:w-max md:max-w-[min(26rem,calc(100vw-2rem))] md:min-w-80 md:animate-pop-in md:rounded-xl',
          alignEnd ? 'md:right-0 md:left-auto' : 'md:right-auto md:left-0',
        )}
      >
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-2xl text-ivory">
              {title}
            </h2>
            <div className="-mr-2 flex items-center">
              {headerActions?.(ctx)}
              <button
                id={closeId}
                type="button"
                aria-label={`Fechar ${title}`}
                onClick={() => close()}
                className="grid size-11 place-items-center rounded-full text-ivory-muted hover:text-ivory focus-visible:outline-2 focus-visible:outline-amber"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>
          <div data-panel-body="">{open ? children(ctx) : null}</div>
        </div>
      </dialog>
    </div>
  );
}

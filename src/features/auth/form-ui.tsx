'use client';

import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from '@/lib/cn';

/** 48 px tall, 16 px text (iOS never zooms in), amber border and ring on focus. */
const INPUT =
  'h-12 w-full rounded-xl border border-ink-600 bg-ink-900 px-4 font-sans text-base text-ivory transition-colors placeholder:text-ivory-muted hover:border-ivory/30 focus:border-amber focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber aria-invalid:border-amber/70 motion-reduce:transition-none';

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id: string;
  label: ReactNode;
  /** Sits at the end of the label row (the "Esqueci minha senha" button). */
  aside?: ReactNode;
  invalid?: boolean;
  /** The id of the message that explains why the field is invalid. */
  errorId?: string;
  inputRef?: Ref<HTMLInputElement>;
};

function LabelRow({ id, label, aside }: { id: string; label: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-1.5 flex min-h-11 items-end justify-between gap-4">
      <label htmlFor={id} className="pb-1 font-sans text-sm font-medium text-ivory">
        {label}
      </label>
      {aside}
    </div>
  );
}

export function Field({ id, label, aside, invalid, errorId, inputRef, className, ...input }: FieldProps) {
  return (
    <div>
      <LabelRow id={id} label={label} aside={aside} />
      <input
        ref={inputRef}
        id={id}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={cn(INPUT, className)}
        {...input}
      />
    </div>
  );
}

/** A password field with a show / hide toggle (typing a password on a phone keyboard is error-prone). */
export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  const { id, label, aside, invalid, errorId, inputRef, ...input } = props;
  return (
    <div>
      <LabelRow id={id} label={label} aside={aside} />
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(INPUT, 'pr-13')}
          {...input}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label="Mostrar senha"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-lg text-ivory-muted transition-colors hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber motion-reduce:transition-none"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </div>
    </div>
  );
}

/** The error under a form: announced on arrival; `hint` is a quieter line under it. */
export function FormError({ id, message, hint }: { id?: string; message: string; hint?: string | null }) {
  return (
    <div className="flex gap-2.5">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber" />
      <div>
        <p id={id} role="alert" className="font-sans text-sm font-medium text-ivory">
          {message}
        </p>
        {hint ? <p className="mt-1 font-sans text-sm text-ivory-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

/** A text-styled button that still has a 44 px target. */
export const LINK_BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-sm font-sans text-sm text-ivory-muted underline decoration-ivory/30 transition-colors hover:text-ivory hover:decoration-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none';

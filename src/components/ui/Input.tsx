import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function Wrap({
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { children: ReactNode }) {
  return (
    <label className="block">
      {label && (
        <span className="field-label">
          {label}
          {required && <span className="text-danger"> *</span>}
        </span>
      )}
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-sm text-ink-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Wrap label={label} hint={hint} error={error} required={required}>
      <input
        className={cn(
          'field-input',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
        {...rest}
      />
    </Wrap>
  );
}

export function Textarea({
  label,
  hint,
  error,
  required,
  className,
  ...rest
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Wrap label={label} hint={hint} error={error} required={required}>
      <textarea
        className={cn(
          'field-input min-h-[88px] leading-relaxed',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className,
        )}
        {...rest}
      />
    </Wrap>
  );
}

export function Select({
  label,
  hint,
  error,
  required,
  className,
  children,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Wrap label={label} hint={hint} error={error} required={required}>
      <div className="relative">
        <select
          className={cn(
            'field-input appearance-none pr-10',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </Wrap>
  );
}

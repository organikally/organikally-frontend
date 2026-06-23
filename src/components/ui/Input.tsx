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
        <span className="mt-1 block text-sm text-muted">{hint}</span>
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
        className={cn('field-input', error && 'border-danger', className)}
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
        className={cn('field-input min-h-[88px]', error && 'border-danger', className)}
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
      <select
        className={cn('field-input appearance-none', error && 'border-danger', className)}
        {...rest}
      >
        {children}
      </select>
    </Wrap>
  );
}

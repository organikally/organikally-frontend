import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'button';
  onPress?: () => void;
  children: ReactNode;
}

export function Card({ className, children, onPress, ...rest }: CardProps) {
  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className={cn(
          'card w-full cursor-pointer p-4 text-left transition-colors duration-200 ease-brand',
          'hover:border-line active:scale-[0.99] active:bg-surface',
          className,
        )}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={cn('card p-4', className)} {...rest}>
      {children}
    </div>
  );
}

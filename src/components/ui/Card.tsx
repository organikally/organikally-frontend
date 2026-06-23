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
          'card w-full text-left p-4 active:bg-surface-2 transition-colors',
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

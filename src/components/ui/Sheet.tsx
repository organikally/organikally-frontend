import { type ReactNode, useEffect } from 'react';
import { cn } from '@/lib/cn';

// Bottom sheet / modal — one-handed friendly, slides up from the bottom.
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'auto',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'auto' | 'tall' | 'full';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px] animate-[sheetFade_.2s_cubic-bezier(.16,1,.3,1)]"
        onClick={onClose}
      />
      <div
        className={cn(
          'relative z-10 flex w-full flex-col rounded-t-card bg-paper shadow-sheet',
          'animate-[sheetUp_.3s_cubic-bezier(.16,1,.3,1)]',
          size === 'tall' && 'max-h-[88dvh]',
          size === 'full' && 'h-[96dvh]',
          size === 'auto' && 'max-h-[88dvh]',
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-pill bg-line" />
        {title && (
          <h2 className="px-5 pb-2 pt-3 font-display text-xl text-ink">
            {title}
          </h2>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto scroll-touch px-5 pb-4">
          {children}
        </div>
        {footer && (
          <div className="border-t border-line bg-paper px-5 pb-safe pt-3">
            {footer}
          </div>
        )}
      </div>
      <style>{`@keyframes sheetUp{from{transform:translateY(16px);opacity:.7}to{transform:translateY(0);opacity:1}}@keyframes sheetFade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}

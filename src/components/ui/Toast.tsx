// Minimal toast system (no dependency). Use via `toast.show(...)`.
import { create } from 'zustand';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: Tone) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push(message, tone = 'info') {
    const id = seq++;
    set((s) => ({ items: [...s.items, { id, message, tone }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss(id) {
    set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push(m, 'success'),
  error: (m: string) => useToastStore.getState().push(m, 'error'),
  info: (m: string) => useToastStore.getState().push(m, 'info'),
};

const toneClass: Record<Tone, string> = {
  success: 'bg-success text-cream',
  error: 'bg-danger text-cream',
  info: 'bg-charcoal text-cream',
};

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto max-w-md rounded-card px-4 py-3 text-sm font-medium shadow-card-lg',
            'animate-[slideUp_.16s_ease-out]',
            toneClass[t.tone],
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}

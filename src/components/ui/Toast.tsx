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

// Paper card + hairline + semantic left accent (DESIGN_SYSTEM §4).
const accentClass: Record<Tone, string> = {
  success: 'border-l-success',
  error: 'border-l-danger',
  info: 'border-l-info',
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
            'pointer-events-auto max-w-md rounded-card border border-line border-l-4 bg-paper px-4 py-3 text-sm font-medium text-ink shadow-md',
            'animate-[toastIn_.3s_cubic-bezier(.16,1,.3,1)]',
            accentClass[t.tone],
          )}
        >
          {t.message}
        </button>
      ))}
      <style>{`@keyframes toastIn{from{transform:translateY(-8px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

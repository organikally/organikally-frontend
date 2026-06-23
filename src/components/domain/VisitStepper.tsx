import { cn } from '@/lib/cn';

const steps = ['Pitch', 'Order', 'Payment', 'Outcome'] as const;
export type VisitStep = (typeof steps)[number];

export function VisitStepper({ current }: { current: VisitStep }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-pill text-xs font-bold',
                i < idx && 'bg-success text-cream',
                i === idx && 'bg-brand text-cream',
                i > idx && 'bg-surface-2 text-muted',
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                'text-[10px] font-semibold',
                i === idx ? 'text-brand' : 'text-muted',
              )}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                'mb-4 h-0.5 flex-1 rounded-pill',
                i < idx ? 'bg-success' : 'bg-line',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

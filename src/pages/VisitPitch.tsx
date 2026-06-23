import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Spinner, EmptyState } from '@/components/ui/Spinner';
import { VisitStepper } from '@/components/domain/VisitStepper';
import { useVisitFlow } from '@/stores/visitFlow';
import { useCatalog } from '@/features/catalog/data';
import { CheckIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

// Pitch / demo log: which SKUs were demoed + free-text notes (CONTRACT visits
// POST /pitch). Persisted on the active visit and submitted at outcome time.
export function VisitPitch() {
  const nav = useNavigate();
  const active = useVisitFlow((s) => s.active);
  const toggle = useVisitFlow((s) => s.toggleDemoed);
  const setNotes = useVisitFlow((s) => s.setPitchNotes);
  const { data: catalog, isLoading } = useCatalog();

  if (!active)
    return (
      <div>
        <TopBar title="Pitch" back />
        <EmptyState
          title="No active visit"
          body="Check in to an outlet to start a visit."
          action={<Button onClick={() => nav('/today')}>Go to today</Button>}
        />
      </div>
    );

  return (
    <div className="pb-28">
      <TopBar title="Pitch & demo" subtitle={active.outletName} back />
      <div className="px-4">
        <VisitStepper current="Pitch" />
      </div>
      <div className="space-y-4 p-4 pt-0">
        <Card>
          <h3 className="mb-2 font-semibold text-ink">Products demoed</h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <div className="space-y-2">
              {(catalog ?? []).map((sku) => {
                const on = active.demoedSkuIds.includes(sku.id);
                return (
                  <button
                    key={sku.id}
                    onClick={() => toggle(sku.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-card border p-3 text-left',
                      on
                        ? 'border-brand bg-brand/5'
                        : 'border-line bg-white',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2',
                        on
                          ? 'border-brand bg-brand text-cream'
                          : 'border-line',
                      )}
                    >
                      {on && <CheckIcon className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {sku.name}
                      </span>
                      <span className="text-xs text-muted">
                        {sku.pack_size} · {sku.category}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <Textarea
            label="Visit notes"
            value={active.pitchNotes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Owner feedback, objections, follow-ups…"
          />
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-xl gap-3 border-t border-line bg-surface/98 p-3 backdrop-blur pb-safe">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => nav('/visit/outcome')}
        >
          Skip to outcome
        </Button>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => nav('/visit/catalog')}
        >
          Take order
        </Button>
      </div>
    </div>
  );
}

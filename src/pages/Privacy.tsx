import type { ReactNode } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/Card';
import { AlertIcon } from '@/components/ui/icons';

// Plain-language privacy & data notice (DPDP Act 2023). Reachable without auth
// so it can be opened from the Login footer and the onboarding consent line.
// DRAFT — the bracketed placeholders MUST be completed and the whole notice
// reviewed by legal before real users are onboarded.

// A clearly-marked fill-in-the-blank the founder must complete before launch.
function Todo({ children }: { children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-block rounded-chip border border-dashed border-warning/60 bg-warning/10 px-1.5 py-0.5 text-[0.8em] font-semibold text-gold-ink">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-2">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-ink-muted">
        {children}
      </div>
    </Card>
  );
}

export function Privacy() {
  return (
    <div className="pb-16">
      <TopBar title="Privacy & data" back showSync={false} />
      <div className="space-y-4 p-4">
        {/* Draft banner — must be removed only once legal has signed off. */}
        <Card className="border-warning/40 bg-warning/5">
          <div className="flex items-start gap-2">
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0 flex-1 text-sm text-ink-muted">
              <p className="font-semibold text-ink">
                DRAFT — needs legal review before real users.
              </p>
              <p className="mt-1">
                Complete every{' '}
                <Todo>[to be completed]</Todo> field below and have this notice
                checked by counsel before onboarding real shops.
              </p>
            </div>
          </div>
        </Card>

        <p className="px-1 text-sm leading-relaxed text-ink-muted">
          This app is used by Organikaly field reps to onboard shops and book
          orders. Here's exactly what it collects, why, and how long we keep it.
          Organikaly is operated by{' '}
          <Todo>[ORGANIKALY LEGAL ENTITY — to be completed]</Todo>
          {' '}(FSSAI licence{' '}
          <Todo>[FSSAI LICENCE NO. — to be completed]</Todo>).
        </p>

        <Section title="What we collect">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <span className="font-medium text-ink">Shop owner details</span> —
              name, phone number and GST/PAN, entered by the rep at onboarding.
            </li>
            <li>
              <span className="font-medium text-ink">Shop location</span> — the
              GPS point of the shopfront, which fixes its map position.
            </li>
            <li>
              <span className="font-medium text-ink">Rep location</span> —
              precise GPS (with accuracy) is recorded at each check-in and
              check-out during a visit.
            </li>
            <li>
              <span className="font-medium text-ink">Live photos</span> — a shop
              photo at onboarding and a photo at each visit.
            </li>
          </ul>
        </Section>

        <Section title="Why we collect it">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>Booking orders and arranging delivery to the shop.</li>
            <li>Contacting the shop owner about their orders and payments.</li>
            <li>
              Verifying that visits actually happened at the shop (location and
              photo confirm a genuine check-in).
            </li>
          </ul>
        </Section>

        <Section title="Photos are live-capture only">
          <p>
            The camera captures a live photo at the moment of the visit. The app
            does not let reps pick older pictures from the phone's gallery, so a
            visit photo always reflects the actual visit.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Shop and order records are kept for as long as the shop is an active
            Organikaly customer and for the period we're required to retain
            business and tax records afterwards. Visit location and photos are
            kept to verify field activity and then removed on the schedule set
            out in our retention policy —{' '}
            <Todo>[RETENTION PERIOD — to be completed]</Todo>.
          </p>
        </Section>

        <Section title="Your rights & contact">
          <p>
            A shop owner can ask what we hold about them, correct it, or ask us
            to delete it, subject to legal record-keeping requirements. To raise
            a request or complaint, contact our grievance officer at{' '}
            <Todo>[GRIEVANCE / DATA CONTACT EMAIL — to be completed]</Todo>.
          </p>
        </Section>

        <p className="px-1 pt-1 text-xs text-ink-faint">
          Consent to store shop owner details is taken by the rep at onboarding
          and recorded against the shop for audit.
        </p>
      </div>
    </div>
  );
}

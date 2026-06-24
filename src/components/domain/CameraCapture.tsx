// Live photo capture control. Uses the native bridge (live capture only — no
// gallery) inside the Expo shell, and an <input capture> fallback in a plain
// browser. Returns a data URL; the caller queues it as a blob for deferred
// upload. Required for onboarding + check-in (CONTRACT §6).

import { useState } from 'react';
import { bridge } from '@/lib/bridge/client';
import { CameraIcon } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/ui/Toast';

interface Props {
  value: string | null; // data URL
  onCapture: (dataUrl: string) => void;
  label?: string;
}

export function CameraCapture({ value, onCapture, label = 'Live photo' }: Props) {
  const [busy, setBusy] = useState(false);

  async function capture() {
    setBusy(true);
    try {
      bridge.haptic('light');
      const res = await bridge.capturePhoto();
      const dataUrl = res.dataUrl;
      if (!dataUrl) {
        // Native returned a fileUri rather than a data URL.
        if (res.fileUri) {
          const blob = await fetch(res.fileUri).then((r) => r.blob());
          const reader = new FileReader();
          reader.onload = () => onCapture(String(reader.result));
          reader.readAsDataURL(blob);
          return;
        }
        throw new Error('No photo returned');
      }
      onCapture(dataUrl);
    } catch (e) {
      const m = (e as Error).message;
      if (m !== 'capture cancelled') toast.error(m || 'Capture failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="field-label">{label}</span>
      {value ? (
        <div className="relative overflow-hidden rounded-card border border-line">
          <img
            src={value}
            alt="Captured"
            className="h-48 w-full object-cover"
          />
          <button
            type="button"
            onClick={capture}
            className="btn-ghost absolute bottom-2 right-2 !min-h-[40px] bg-surface/90 px-3 text-sm shadow-sm"
          >
            <CameraIcon className="h-4 w-4" /> Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={capture}
          disabled={busy}
          className="flex h-48 w-full flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface text-ink-faint transition-colors duration-200 ease-brand active:bg-line/40"
        >
          {busy ? (
            <Spinner />
          ) : (
            <>
              <CameraIcon className="h-9 w-9 text-gold-ink" />
              <span className="text-sm font-semibold text-ink">
                Take live photo
              </span>
              <span className="text-xs">Camera only, no gallery</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

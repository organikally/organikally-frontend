import { useMemo } from 'react';
import { bridge, hasNativeBridge } from '@/lib/bridge/client';

export function useBridge() {
  return useMemo(
    () => ({ bridge, isNative: hasNativeBridge() }),
    [],
  );
}

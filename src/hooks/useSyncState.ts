import { useEffect, useState } from 'react';
import { syncEngine, type SyncState } from '@/lib/offline/sync';

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(syncEngine.getState());
  useEffect(() => syncEngine.subscribe(setState), []);
  return state;
}

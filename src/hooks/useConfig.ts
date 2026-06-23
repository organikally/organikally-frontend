import { useEffect, useState } from 'react';
import { DEFAULT_CONFIG, readCachedConfig } from '@/lib/offline/bootstrap';
import type { TenantConfig } from '@/types/models';

export function useConfig(): TenantConfig {
  const [cfg, setCfg] = useState<TenantConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    let alive = true;
    readCachedConfig().then((c) => {
      if (alive && c) setCfg(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
}

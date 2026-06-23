import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { getDB, putVisit } from '@/lib/offline/db';
import { todayIso } from '@/lib/format';
import { useSession } from '@/stores/session';
import type { Visit } from '@/types/models';

// Today's visits for the current rep — used for route progress.
export function useOutletVisitsToday() {
  const repId = useSession((s) => s.user?.id);
  return useQuery<Visit[]>({
    queryKey: ['visits-today', repId],
    enabled: !!repId,
    queryFn: async () => {
      const db = await getDB();
      const date = todayIso();
      try {
        const res = await api.listVisits({ rep_id: repId, date });
        for (const v of res.items) await putVisit(v);
      } catch {
        /* offline */
      }
      // Combine server + local optimistic visits created today.
      const all = await db.getAll('visits');
      return all.filter((v) => (v.created_at ?? '').slice(0, 10) === date);
    },
    staleTime: 15_000,
  });
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Prefills a feature form cycle selector from `?cycle=` without blocking direct visits. */
export function usePrefillCycleId(): [string, (id: string) => void] {
  const [params] = useSearchParams();
  const fromQuery = params.get('cycle')?.trim() ?? '';
  const [cycleId, setCycleId] = useState(fromQuery);

  useEffect(() => {
    if (fromQuery) setCycleId(fromQuery);
  }, [fromQuery]);

  return [cycleId, setCycleId];
}

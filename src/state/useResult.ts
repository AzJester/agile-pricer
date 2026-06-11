import { useMemo } from 'react';
import { compute, type ComputeResult } from '../engine';
import { useActivePursuit } from './store';

/** Computed results for the active pursuit, memoized on its data identity. */
export function useResult(): ComputeResult {
  const pursuit = useActivePursuit();
  return useMemo(() => compute(pursuit), [pursuit]);
}

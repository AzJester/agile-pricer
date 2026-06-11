import { compute, type ComputeResult, type Pursuit } from '../engine';
import { useActivePursuit } from './store';

// Module-level cache keyed on the pursuit's immutable identity (immer gives
// every commit a fresh object). A per-component useMemo would re-run the
// full engine once per call site — the header alone mounts three.
const cache = new WeakMap<Pursuit, ComputeResult>();

/** compute() memoized on data identity; shared by every caller. */
export function computeCached(pursuit: Pursuit): ComputeResult {
  let r = cache.get(pursuit);
  if (!r) {
    r = compute(pursuit);
    cache.set(pursuit, r);
  }
  return r;
}

/** Computed results for the active pursuit. */
export function useResult(): ComputeResult {
  return computeCached(useActivePursuit());
}

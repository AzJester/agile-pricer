import { produce } from 'immer';
import { create } from 'zustand';
import {
  baselineSeed,
  blankSeed,
  calibratedSeed,
  demoSeed,
  repairPursuit,
  type Pursuit,
} from '../engine';

export const STORAGE_KEY = 'agile-pricer-v1';
const UNDO_LIMIT = 60;

export interface PursuitEntry {
  id: string;
  data: Pursuit;
}

export interface IndirectRateSet {
  name: string;
  fringe: number;
  overhead: number;
  gna: number;
}

interface PersistedState {
  pursuits: PursuitEntry[];
  activeId: string;
  rateLibrary: IndirectRateSet[];
  tipsOn: boolean;
}

interface Snapshot {
  pursuits: PursuitEntry[];
  activeId: string;
}

export interface AppState extends PersistedState {
  past: Snapshot[];
  future: Snapshot[];
  toast: string | null;

  updateActive: (mutator: (p: Pursuit) => void) => void;
  switchPursuit: (id: string) => void;
  newPursuit: (name: string, fromBaseline: boolean) => void;
  duplicatePursuit: () => void;
  deletePursuit: () => void;
  renamePursuit: (name: string) => void;
  importPursuit: (data: unknown) => void;
  importPortfolio: (data: unknown) => number;
  undo: () => void;
  redo: () => void;
  toggleTips: () => void;
  applyRateSet: (name: string) => void;
  saveRateSet: (name: string) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

function uid(): string {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const DEFAULT_RATE_LIBRARY: IndirectRateSet[] = [
  { name: 'Full Government Burden', fringe: 0.3, overhead: 0.45, gna: 0.12 },
  { name: 'IRAD / Light Indirect', fringe: 0.25, overhead: 0.15, gna: 0.08 },
  { name: 'Commercial', fringe: 0.22, overhead: 0.2, gna: 0.1 },
];

function seedState(): PersistedState {
  const a = { id: uid(), data: baselineSeed() };
  const b = { id: uid(), data: calibratedSeed() };
  const c = { id: uid(), data: demoSeed() };
  return { pursuits: [a, b, c], activeId: a.id, rateLibrary: DEFAULT_RATE_LIBRARY, tipsOn: true };
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (!Array.isArray(parsed.pursuits) || !parsed.pursuits.length) return seedState();
    const pursuits = parsed.pursuits.map((p) => ({ id: p.id || uid(), data: repairPursuit(p.data) }));
    const activeId = pursuits.some((p) => p.id === parsed.activeId) ? parsed.activeId! : pursuits[0].id;
    return {
      pursuits,
      activeId,
      rateLibrary:
        Array.isArray(parsed.rateLibrary) && parsed.rateLibrary.length ? parsed.rateLibrary : DEFAULT_RATE_LIBRARY,
      tipsOn: parsed.tipsOn !== false,
    };
  } catch {
    return seedState();
  }
}

function persist(s: PersistedState) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ pursuits: s.pursuits, activeId: s.activeId, rateLibrary: s.rateLibrary, tipsOn: s.tipsOn }),
    );
    return true;
  } catch {
    return false;
  }
}

function snapshot(s: Pick<AppState, 'pursuits' | 'activeId'>): Snapshot {
  return { pursuits: s.pursuits, activeId: s.activeId };
}

export const useStore = create<AppState>((set, get) => {
  const initial = loadPersisted();

  /** Apply a state change with undo tracking and persistence. */
  function commit(next: Partial<PersistedState>) {
    const cur = get();
    const past = [...cur.past, snapshot(cur)].slice(-UNDO_LIMIT);
    const merged = { ...cur, ...next, past, future: [] as Snapshot[] };
    if (!persist(merged)) {
      merged.toast = 'Storage unavailable — use Export JSON to keep your work';
    }
    set(merged);
  }

  return {
    ...initial,
    past: [],
    future: [],
    toast: null,

    updateActive: (mutator) => {
      const { pursuits, activeId } = get();
      const next = pursuits.map((p) => (p.id === activeId ? { ...p, data: produce(p.data, mutator) } : p));
      commit({ pursuits: next });
    },

    switchPursuit: (id) => {
      if (!get().pursuits.some((p) => p.id === id)) return;
      commit({ activeId: id });
    },

    newPursuit: (name, fromBaseline) => {
      const data = fromBaseline ? baselineSeed() : blankSeed();
      if (name.trim()) data.name = name.trim();
      const entry = { id: uid(), data };
      commit({ pursuits: [...get().pursuits, entry], activeId: entry.id });
      get().showToast('Pursuit created');
    },

    duplicatePursuit: () => {
      const { pursuits, activeId } = get();
      const active = pursuits.find((p) => p.id === activeId);
      if (!active) return;
      const copy: PursuitEntry = { id: uid(), data: JSON.parse(JSON.stringify(active.data)) };
      copy.data.name += ' (copy)';
      commit({ pursuits: [...pursuits, copy], activeId: copy.id });
      get().showToast('Duplicated');
    },

    deletePursuit: () => {
      const { pursuits, activeId } = get();
      if (pursuits.length <= 1) {
        get().showToast('Cannot delete the only pursuit');
        return;
      }
      const next = pursuits.filter((p) => p.id !== activeId);
      commit({ pursuits: next, activeId: next[0].id });
      get().showToast('Deleted');
    },

    renamePursuit: (name) => {
      if (!name.trim()) return;
      get().updateActive((p) => {
        p.name = name.trim();
      });
    },

    importPursuit: (data) => {
      const repaired = repairPursuit(data);
      const entry = { id: uid(), data: repaired };
      commit({ pursuits: [...get().pursuits, entry], activeId: entry.id });
      get().showToast(`Imported "${repaired.name}"`);
    },

    importPortfolio: (data) => {
      if (!data || typeof data !== 'object') return 0;
      const d = data as { pursuits?: { data?: unknown }[]; rateLibrary?: IndirectRateSet[] };
      if (!Array.isArray(d.pursuits)) return 0;
      const incoming = d.pursuits.map((p) => ({ id: uid(), data: repairPursuit(p?.data) }));
      const rateLibrary = [...get().rateLibrary];
      if (Array.isArray(d.rateLibrary)) {
        for (const rs of d.rateLibrary) {
          if (rs && typeof rs.name === 'string' && !rateLibrary.some((x) => x.name === rs.name)) {
            rateLibrary.push(rs);
          }
        }
      }
      commit({ pursuits: [...get().pursuits, ...incoming], rateLibrary });
      return incoming.length;
    },

    undo: () => {
      const { past, future, pursuits, activeId } = get();
      if (!past.length) {
        get().showToast('Nothing to undo');
        return;
      }
      const prev = past[past.length - 1];
      const next = {
        pursuits: prev.pursuits,
        activeId: prev.pursuits.some((p) => p.id === prev.activeId) ? prev.activeId : prev.pursuits[0].id,
        past: past.slice(0, -1),
        future: [...future, snapshot({ pursuits, activeId })],
      };
      set(next);
      persist({ ...get(), ...next });
      get().showToast('Undone');
    },

    redo: () => {
      const { past, future, pursuits, activeId } = get();
      if (!future.length) {
        get().showToast('Nothing to redo');
        return;
      }
      const nxt = future[future.length - 1];
      const next = {
        pursuits: nxt.pursuits,
        activeId: nxt.pursuits.some((p) => p.id === nxt.activeId) ? nxt.activeId : nxt.pursuits[0].id,
        past: [...past, snapshot({ pursuits, activeId })],
        future: future.slice(0, -1),
      };
      set(next);
      persist({ ...get(), ...next });
      get().showToast('Redone');
    },

    toggleTips: () => {
      commit({ tipsOn: !get().tipsOn });
    },

    applyRateSet: (name) => {
      const set_ = get().rateLibrary.find((x) => x.name === name);
      if (!set_) return;
      get().updateActive((p) => {
        p.control.fringe = set_.fringe;
        p.control.overhead = set_.overhead;
        p.control.gna = set_.gna;
      });
      get().showToast(`Applied "${name}" indirect rates`);
    },

    saveRateSet: (name) => {
      if (!name.trim()) return;
      const { pursuits, activeId, rateLibrary } = get();
      const active = pursuits.find((p) => p.id === activeId);
      if (!active) return;
      const c = active.data.control;
      const existing = rateLibrary.find((x) => x.name === name);
      const next = existing
        ? rateLibrary.map((x) => (x.name === name ? { ...x, fringe: c.fringe, overhead: c.overhead, gna: c.gna } : x))
        : [...rateLibrary, { name, fringe: c.fringe, overhead: c.overhead, gna: c.gna }];
      commit({ rateLibrary: next });
      get().showToast('Saved indirect-rate set');
    },

    showToast: (msg) => set({ toast: msg }),
    clearToast: () => set({ toast: null }),
  };
});

export function useActivePursuit(): Pursuit {
  return useStore((s) => s.pursuits.find((p) => p.id === s.activeId)?.data ?? s.pursuits[0].data);
}

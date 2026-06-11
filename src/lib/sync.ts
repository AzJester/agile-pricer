import type { IndirectRateSet, PursuitEntry } from '../state/store';

/**
 * Client for the optional portfolio sync server (server/server.mjs).
 * Configuration lives outside the undoable store, keyed per browser.
 */

const CONFIG_KEY = 'agile-pricer-sync-v1';

export interface SyncConfig {
  url: string;
  portfolioId: string;
  token: string;
  /** Last revision seen from the server, for optimistic concurrency. */
  rev: number;
}

export interface RemotePortfolio {
  rev: number;
  savedAt: string;
  data: { pursuits: PursuitEntry[]; rateLibrary: IndirectRateSet[] };
}

export function loadSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { url: '', portfolioId: 'default', token: '', rev: 0, ...JSON.parse(raw) };
  } catch {
    /* fall through */
  }
  return { url: '', portfolioId: 'default', token: '', rev: 0 };
}

export function saveSyncConfig(cfg: SyncConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* storage unavailable; config stays in memory */
  }
}

function headers(cfg: SyncConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.token) h.Authorization = `Bearer ${cfg.token}`;
  return h;
}

function endpoint(cfg: SyncConfig): string {
  return cfg.url.replace(/\/+$/, '') + '/api/portfolio/' + encodeURIComponent(cfg.portfolioId || 'default');
}

/** True when the browser will block the request as mixed content. */
export function isMixedContent(url: string): boolean {
  return typeof location !== 'undefined' && location.protocol === 'https:' && /^http:\/\//i.test(url.trim());
}

const FETCH_TIMEOUT_MS = 15_000;

async function request(cfg: SyncConfig, init: RequestInit): Promise<Response> {
  try {
    return await fetch(endpoint(cfg), { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    // fetch network failures are a bare TypeError; translate to something a
    // user can act on instead of "Failed to fetch".
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new Error(`No response after ${FETCH_TIMEOUT_MS / 1000}s — is the sync server running?`);
    }
    if (isMixedContent(cfg.url)) {
      throw new Error(
        'Blocked as mixed content: this page is HTTPS, so the browser refuses a plain http:// sync URL. Serve the sync server behind TLS.',
      );
    }
    throw new Error('Could not reach the server — check the URL and that the sync server is running.');
  }
}

export async function pullPortfolio(cfg: SyncConfig): Promise<RemotePortfolio> {
  const res = await request(cfg, { headers: headers(cfg) });
  if (res.status === 404) throw new Error('No portfolio on the server yet — push first.');
  if (res.status === 401) throw new Error('Unauthorized — check the access token.');
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return (await res.json()) as RemotePortfolio;
}

export async function pushPortfolio(
  cfg: SyncConfig,
  data: { pursuits: PursuitEntry[]; rateLibrary: IndirectRateSet[] },
): Promise<number> {
  const res = await request(cfg, {
    method: 'PUT',
    headers: headers(cfg),
    body: JSON.stringify({ rev: cfg.rev, data }),
  });
  if (res.status === 409) {
    const body = (await res.json()) as { rev?: number };
    throw new ConflictError(body.rev ?? 0);
  }
  if (res.status === 401) throw new Error('Unauthorized — check the access token.');
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const body = (await res.json()) as { rev: number };
  return body.rev;
}

export class ConflictError extends Error {
  serverRev: number;
  constructor(serverRev: number) {
    super('Someone else pushed a newer portfolio. Pull first, or force-push to overwrite.');
    this.serverRev = serverRev;
  }
}

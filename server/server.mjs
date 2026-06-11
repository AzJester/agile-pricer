#!/usr/bin/env node
/**
 * Minimal portfolio sync server — zero dependencies.
 *
 * Stores one portfolio document (pursuits + rate library) per portfolio id
 * in a JSON file, with optimistic concurrency via a revision counter.
 *
 *   node server/server.mjs                  # no auth -> binds 127.0.0.1:8787 (loopback only)
 *   API_TOKEN=secret node server/server.mjs # require Bearer token; binds 0.0.0.0
 *   HOST=0.0.0.0 PORT=9000 DATA_DIR=/srv/pricer ALLOWED_ORIGIN=https://team.example.com \
 *     API_TOKEN=secret node server/server.mjs
 *
 * Endpoints:
 *   GET  /api/health                       -> { ok: true }
 *   GET  /api/portfolio/:id                -> { rev, savedAt, data } | 404
 *   PUT  /api/portfolio/:id  {rev, data}   -> { rev } | 409 on rev conflict
 *
 * Auth: when API_TOKEN is set, requests must send
 * "Authorization: Bearer <token>" (compared in constant time). Without a
 * token the server refuses to listen beyond loopback unless HOST is set
 * explicitly. For enterprise SSO, replace checkAuth() with JWT validation
 * against your IdP (e.g. Entra ID: verify the token's signature via the
 * tenant JWKS endpoint and check audience + tenant id). Always run behind
 * TLS in real deployments. Requests are logged (timestamp, ip, method,
 * path, status) for audit; tokens are never logged.
 *
 * Run exactly one process per DATA_DIR: the revision check relies on the
 * single-threaded event loop for atomicity, and there is no file lock.
 */
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const API_TOKEN = process.env.API_TOKEN || '';
// An unauthenticated server bound to 0.0.0.0 lets any site a LAN user visits
// read and overwrite every portfolio via their browser (wildcard CORS).
const HOST = process.env.HOST || (API_TOKEN ? '0.0.0.0' : '127.0.0.1');
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_BODY = 25 * 1024 * 1024; // 25 MiB portfolio ceiling (bytes)

mkdirSync(DATA_DIR, { recursive: true });

const sha256 = (s) => createHash('sha256').update(s).digest();
const expectedAuth = API_TOKEN ? sha256(`Bearer ${API_TOKEN}`) : null;

function checkAuth(req) {
  if (!expectedAuth) return true;
  // Hash both sides to a fixed length, then compare in constant time.
  return timingSafeEqual(sha256(String(req.headers.authorization || '')), expectedAuth);
}

function fileFor(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return null;
  return join(DATA_DIR, `portfolio-${safe}.json`);
}

function send(req, res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    ...(ALLOWED_ORIGIN !== '*' ? { Vary: 'Origin' } : {}),
  });
  res.end(status === 204 ? undefined : JSON.stringify(body));
  console.log(`${new Date().toISOString()} ${req.socket.remoteAddress ?? '-'} ${req.method} ${req.url} ${status}`);
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(req, res, 204, {});
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/health') return send(req, res, 200, { ok: true });

  const match = /^\/api\/portfolio\/([^/]+)$/.exec(url.pathname);
  if (!match) return send(req, res, 404, { error: 'not found' });
  if (!checkAuth(req)) {
    // A small randomized delay blunts brute-force token guessing.
    setTimeout(() => send(req, res, 401, { error: 'unauthorized' }), 250 + Math.random() * 250);
    return;
  }
  const file = fileFor(match[1]);
  if (!file) return send(req, res, 400, { error: 'bad portfolio id' });

  if (req.method === 'GET') {
    if (!existsSync(file)) return send(req, res, 404, { error: 'no such portfolio' });
    try {
      return send(req, res, 200, JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      return send(req, res, 500, { error: 'corrupt portfolio file' });
    }
  }

  if (req.method === 'PUT') {
    const chunks = [];
    let bytes = 0;
    let overflow = false;
    req.on('data', (chunk) => {
      if (overflow) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY) {
        overflow = true;
        chunks.length = 0;
        // Deliver the 413 before killing the socket; destroying the request
        // first left clients with a bare connection reset.
        res.once('finish', () => req.destroy());
        send(req, res, 413, { error: 'portfolio too large' });
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (overflow) return;
      let parsed;
      try {
        // Concatenate buffers before decoding: per-chunk string conversion
        // silently corrupts multibyte characters split across chunks.
        parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(req, res, 400, { error: 'invalid JSON' });
      }
      const data = parsed && typeof parsed === 'object' ? parsed.data : null;
      if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.pursuits)) {
        return send(req, res, 400, { error: 'expected { rev, data: { pursuits: [...] } }' });
      }
      let currentRev = 0;
      if (existsSync(file)) {
        try {
          currentRev = Number(JSON.parse(readFileSync(file, 'utf8')).rev) || 0;
        } catch {
          currentRev = 0;
        }
      }
      const sentRev = Number(parsed.rev) || 0;
      if (currentRev !== 0 && sentRev !== currentRev) {
        return send(req, res, 409, { error: 'revision conflict', rev: currentRev });
      }
      const next = { rev: currentRev + 1, savedAt: new Date().toISOString(), data };
      const tmp = file + '.tmp';
      writeFileSync(tmp, JSON.stringify(next));
      renameSync(tmp, file);
      return send(req, res, 200, { rev: next.rev });
    });
    return;
  }

  return send(req, res, 405, { error: 'method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(
    `agile-pricer sync server on ${HOST}:${PORT}, data in ${DATA_DIR}` +
      (API_TOKEN ? ', token auth ON' : ', no auth — loopback only (set API_TOKEN to serve the network)'),
  );
});

#!/usr/bin/env node
/**
 * Minimal portfolio sync server — zero dependencies.
 *
 * Stores one portfolio document (pursuits + rate library) per portfolio id
 * in a JSON file, with optimistic concurrency via a revision counter.
 *
 *   node server/server.mjs                 # listens on :8787, data in ./data
 *   PORT=9000 DATA_DIR=/srv/pricer node server/server.mjs
 *   API_TOKEN=secret node server/server.mjs   # require Bearer token
 *
 * Endpoints:
 *   GET  /api/health                       -> { ok: true }
 *   GET  /api/portfolio/:id                -> { rev, savedAt, data } | 404
 *   PUT  /api/portfolio/:id  {rev, data}   -> { rev } | 409 on rev conflict
 *
 * Auth: when API_TOKEN is set, requests must send
 * "Authorization: Bearer <token>". For enterprise SSO, replace checkAuth()
 * with JWT validation against your IdP (e.g. Entra ID: verify the token's
 * signature via the tenant JWKS endpoint and check audience + tenant id).
 * Always run behind TLS in real deployments.
 */
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const API_TOKEN = process.env.API_TOKEN || '';
const MAX_BODY = 25 * 1024 * 1024; // 25 MB portfolio ceiling

mkdirSync(DATA_DIR, { recursive: true });

function fileFor(id) {
  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safe) return null;
  return join(DATA_DIR, `portfolio-${safe}.json`);
}

function checkAuth(req) {
  if (!API_TOKEN) return true;
  const h = req.headers.authorization || '';
  return h === `Bearer ${API_TOKEN}`;
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  });
  res.end(json);
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/health') return send(res, 200, { ok: true });

  const match = /^\/api\/portfolio\/([^/]+)$/.exec(url.pathname);
  if (!match) return send(res, 404, { error: 'not found' });
  if (!checkAuth(req)) return send(res, 401, { error: 'unauthorized' });
  const file = fileFor(match[1]);
  if (!file) return send(res, 400, { error: 'bad portfolio id' });

  if (req.method === 'GET') {
    if (!existsSync(file)) return send(res, 404, { error: 'no such portfolio' });
    try {
      return send(res, 200, JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      return send(res, 500, { error: 'corrupt portfolio file' });
    }
  }

  if (req.method === 'PUT') {
    let body = '';
    let overflow = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        overflow = true;
        req.destroy();
      }
    });
    req.on('close', () => {
      if (overflow) send(res, 413, { error: 'portfolio too large' });
    });
    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return send(res, 400, { error: 'invalid JSON' });
      }
      if (!parsed || typeof parsed !== 'object' || !parsed.data) {
        return send(res, 400, { error: 'expected { rev, data }' });
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
        return send(res, 409, { error: 'revision conflict', rev: currentRev });
      }
      const next = { rev: currentRev + 1, savedAt: new Date().toISOString(), data: parsed.data };
      const tmp = file + '.tmp';
      writeFileSync(tmp, JSON.stringify(next));
      renameSync(tmp, file);
      return send(res, 200, { rev: next.rev });
    });
    return;
  }

  return send(res, 405, { error: 'method not allowed' });
});

server.listen(PORT, () => {
  console.log(`agile-pricer sync server on :${PORT}, data in ${DATA_DIR}${API_TOKEN ? ', token auth ON' : ', no auth (dev)'}`);
});

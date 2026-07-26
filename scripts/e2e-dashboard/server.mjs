#!/usr/bin/env node
/**
 * Dashboard local para rodar Playwright e ver resumo + report HTML.
 * Uso: node scripts/e2e-dashboard/server.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORT_DIR = path.join(ROOT, 'playwright-report');
const RESULTS_JSON = path.join(ROOT, 'test-results', 'results.json');

const DEFAULT_PORT = Number(process.env.E2E_DASHBOARD_PORT ?? 4173);
const HOST = process.env.E2E_DASHBOARD_HOST ?? '127.0.0.1';
const PORT_ATTEMPTS = 10;

/** @type {import('node:child_process').ChildProcess | null} */
let activeProcess = null;
/** @type {{ status: 'idle' | 'running'; startedAt: string | null; exitCode: number | null; target: string | null; args: string[] }} */
let runState = { status: 'idle', startedAt: null, exitCode: null, target: null, args: [] };
/** @type {Set<import('node:http').ServerResponse>} */
const sseClients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

function pushLog(line, stream = 'stdout') {
  broadcast('log', { line, stream, at: new Date().toISOString() });
}

function mime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webm': 'video/webm',
    '.svg': 'image/svg+xml',
  };
  return map[ext] ?? 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function flattenSuites(suites, parent = '') {
  const rows = [];
  for (const suite of suites ?? []) {
    const title = parent ? `${parent} › ${suite.title}` : suite.title;
    for (const spec of suite.specs ?? []) {
      const test = spec.tests?.[0];
      const result = test?.results?.[0];
      rows.push({
        title: `${title} › ${spec.title}`,
        status: test?.status ?? result?.status ?? 'unknown',
        duration: result?.duration ?? 0,
        project: test?.projectName ?? result?.workerIndex ?? '',
        error: result?.error?.message ?? null,
      });
    }
    if (suite.suites?.length) {
      rows.push(...flattenSuites(suite.suites, title));
    }
  }
  return rows;
}

function loadResults() {
  if (!fs.existsSync(RESULTS_JSON)) {
    return { available: false, stats: null, tests: [], path: RESULTS_JSON };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8'));
    return {
      available: true,
      stats: raw.stats ?? null,
      tests: flattenSuites(raw.suites),
      generatedAt: fs.statSync(RESULTS_JSON).mtime.toISOString(),
    };
  } catch (err) {
    return { available: false, error: String(err), stats: null, tests: [] };
  }
}

function reportAvailable() {
  return fs.existsSync(path.join(REPORT_DIR, 'index.html'));
}

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

function buildPlaywrightArgs(body) {
  const args = ['playwright', 'test'];
  const project = body.project?.trim();
  const grep = body.grep?.trim();
  const workers = body.workers;

  if (project && project !== 'all') {
    args.push(`--project=${project}`);
  }
  if (grep) {
    args.push('-g', grep);
  }
  if (body.headed) {
    args.push('--headed');
  }
  if (workers != null && workers !== '') {
    args.push(`--workers=${workers}`);
  }
  if (body.ui) {
    args.push('--ui');
  }
  return args;
}

function startRun(body) {
  if (activeProcess) {
    return { ok: false, error: 'Já existe uma execução em andamento.' };
  }

  const target = body.target === 'local' ? 'local' : 'app';
  const pwArgs = buildPlaywrightArgs(body);

  runState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    exitCode: null,
    target,
    args: pwArgs.slice(2),
  };

  broadcast('status', runState);
  pushLog(`▶ E2E_TARGET=${target} npx ${pwArgs.join(' ')}`, 'system');

  activeProcess = spawn('npx', pwArgs, {
    cwd: ROOT,
    env: { ...process.env, E2E_TARGET: target, FORCE_COLOR: '1' },
    shell: true,
  });

  const onData = (stream) => (chunk) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) pushLog(line, stream);
    }
  };

  activeProcess.stdout?.on('data', onData('stdout'));
  activeProcess.stderr?.on('data', onData('stderr'));

  activeProcess.on('close', (code) => {
    activeProcess = null;
    runState = {
      ...runState,
      status: 'idle',
      exitCode: code ?? 1,
    };
    pushLog(`■ Finalizado com código ${code ?? 1}`, 'system');
    broadcast('status', runState);
    broadcast('results', loadResults());
  });

  activeProcess.on('error', (err) => {
    pushLog(`Erro ao iniciar processo: ${err.message}`, 'stderr');
  });

  return { ok: true, run: runState };
}

function stopRun() {
  if (!activeProcess) {
    return { ok: false, error: 'Nenhuma execução ativa.' };
  }
  activeProcess.kill('SIGTERM');
  pushLog('■ Execução interrompida pelo usuário', 'system');
  return { ok: true };
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/status') {
    return json(res, 200, {
      ...runState,
      reportAvailable: reportAvailable(),
      results: loadResults(),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/results') {
    return json(res, 200, loadResults());
  }

  if (req.method === 'GET' && url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`event: status\ndata: ${JSON.stringify(runState)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/run') {
    try {
      const body = await readBody(req);
      const result = startRun(body);
      return json(res, result.ok ? 202 : 409, result);
    } catch {
      return json(res, 400, { ok: false, error: 'JSON inválido' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/stop') {
    return json(res, 200, stopRun());
  }

  if (url.pathname === '/report' || url.pathname === '/report/') {
    const index = path.join(REPORT_DIR, 'index.html');
    if (!fs.existsSync(index)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>Report indisponível</h1><p>Rode os testes primeiro.</p>');
      return;
    }
    res.writeHead(302, { Location: '/report/index.html' });
    res.end();
    return;
  }

  if (url.pathname.startsWith('/report/')) {
    const rel = decodeURIComponent(url.pathname.slice('/report/'.length));
    const filePath = path.normalize(path.join(REPORT_DIR, rel));
    if (!filePath.startsWith(REPORT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    return serveFile(res, filePath);
  }

  let filePath = path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  serveFile(res, filePath);
});

function printBanner(port) {
  console.log(`E2E Dashboard: http://${HOST}:${port}`);
  console.log(`Report HTML:  http://${HOST}:${port}/report/`);
}

async function probeDashboard(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${port}/api/status`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        try {
          const data = JSON.parse(body);
          resolve(typeof data.status === 'string');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function listen(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, HOST);
  });
}

(async () => {
  for (let i = 0; i < PORT_ATTEMPTS; i++) {
    const port = DEFAULT_PORT + i;
    try {
      const bound = await listen(port);
      printBanner(bound);
      return;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') {
        console.error(err);
        process.exit(1);
      }
      const isDashboard = await probeDashboard(port);
      if (isDashboard) {
        console.log(`Dashboard já está em execução: http://${HOST}:${port}`);
        console.log('Abra essa URL no navegador ou encerre o processo anterior.');
        process.exit(0);
      }
      if (i === PORT_ATTEMPTS - 1) {
        console.error(
          `Portas ${DEFAULT_PORT}–${DEFAULT_PORT + PORT_ATTEMPTS - 1} em uso. Defina outra com E2E_DASHBOARD_PORT=4185`
        );
        process.exit(1);
      }
    }
  }
})();

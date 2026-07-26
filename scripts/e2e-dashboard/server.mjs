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
import {
  buildSessionCookie,
  clearSessionCookie,
  createSessionPayload,
  getSession,
  isSecureRequest,
  platformLogin,
  PLATFORM_API_URL,
} from './auth.mjs';
import {
  ensureBrowsersInstalled,
  getBrowserStatus,
  browsersInstalled,
} from '../playwright-ensure-browsers.mjs';
import { usesRemoteBrowser, isSharedHosting } from '../playwright-remote.mjs';
import {
  resolvePlaywrightCli,
  buildPathEnv,
} from '../playwright-cli.mjs';
import {
  cancelWorkflowRun,
  clearGithubRunState,
  dispatchWorkflow,
  downloadRunArtifacts,
  extractPlaywrightLogLines,
  fetchRunLogsText,
  fetchRunProgress,
  fetchRunStatus,
  buildGithubActionsUrl,
  getRunnerMode,
  githubConfigured,
  isGithubRunner,
  loadGithubRunState,
  saveGithubRunState,
} from './github-runner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORT_DIR = path.join(ROOT, 'playwright-report');
const RESULTS_JSON = path.join(ROOT, 'test-results', 'results.json');

const PLATFORM_PORT = process.env.PORT ? Number(process.env.PORT) : null;
const DEFAULT_PORT = PLATFORM_PORT ?? Number(process.env.E2E_DASHBOARD_PORT ?? 4173);
const HOST = process.env.E2E_DASHBOARD_HOST ?? (PLATFORM_PORT ? '0.0.0.0' : '127.0.0.1');
const PORT_ATTEMPTS = PLATFORM_PORT ? 1 : 10;

/** @type {import('node:child_process').ChildProcess | null} */
let activeProcess = null;
/** @type {ReturnType<typeof setInterval> | null} */
let githubPollTimer = null;
/** @type {number | null} */
let githubRunId = null;
/** @type {string | null} */
let lastGithubStepsKey = null;
/** @type {{ status: 'idle' | 'running'; startedAt: string | null; exitCode: number | null; target: string | null; args: string[]; runner?: string; githubRunUrl?: string | null }} */
let runState = { status: 'idle', startedAt: null, exitCode: null, target: null, args: [], runner: getRunnerMode() };
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
  const args = ['test'];
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

  if (isSharedHosting() && !usesRemoteBrowser()) {
    return {
      ok: false,
      error:
        'Chromium não roda em hospedagem compartilhada. Configure GITHUB_TOKEN para GitHub Actions ou PLAYWRIGHT_WS_ENDPOINT para browser remoto.',
    };
  }

  const cli = resolvePlaywrightCli();
  if (!cli) {
    return {
      ok: false,
      error: 'Playwright não encontrado. Rode npm install na raiz do projeto.',
    };
  }

  const target = body.target === 'local' ? 'local' : 'app';
  const pwArgs = buildPlaywrightArgs(body);
  const nodeBin = process.execPath;
  const cmdArgs = [cli, ...pwArgs];

  runState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    exitCode: null,
    target,
    args: pwArgs,
  };

  broadcast('status', runState);
  pushLog(`▶ E2E_TARGET=${target} ${nodeBin} ${path.basename(cli)} ${pwArgs.join(' ')}`, 'system');

  activeProcess = spawn(nodeBin, cmdArgs, {
    cwd: ROOT,
    env: buildPathEnv({ E2E_TARGET: target, FORCE_COLOR: '1' }),
    shell: false,
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

function finishRun(exitCode, extra = {}) {
  runState = {
    ...runState,
    status: 'idle',
    exitCode,
    ...extra,
  };
  pushLog(`■ Finalizado com código ${exitCode}`, 'system');
  broadcast('status', runState);
  broadcast('results', loadResults());
  githubRunId = null;
  clearGithubRunState();
  if (githubPollTimer) {
    clearInterval(githubPollTimer);
    githubPollTimer = null;
  }
}

async function pollGithubRun(runId) {
  try {
    const [run, progress] = await Promise.all([fetchRunStatus(runId), fetchRunProgress(runId)]);

    const statusKey = `${run.status}:${run.conclusion ?? ''}`;
    if (statusKey !== lastGithubPollStatus) {
      const label = run.conclusion ? `${run.status} (${run.conclusion})` : run.status;
      pushLog(`GitHub Actions: ${label}`, 'system');
      lastGithubPollStatus = statusKey;
    }

    const stepsKey = progress.steps.map((s) => `${s.name}:${s.status}:${s.conclusion ?? ''}`).join('|');
    if (stepsKey && stepsKey !== lastGithubStepsKey) {
      lastGithubStepsKey = stepsKey;
      broadcast('github-progress', {
        status: 'running',
        githubRepo: REPO_GITHUB(),
        githubRunId: runId,
        htmlUrl: run.htmlUrl,
        githubActionsUrl: buildGithubActionsUrl(runId, run.htmlUrl),
        progress,
      });
    }

    runState = {
      ...runState,
      githubRepo: REPO_GITHUB(),
      githubRunId: runId,
      githubRunUrl: run.htmlUrl,
      githubActionsUrl: buildGithubActionsUrl(runId, run.htmlUrl),
      githubProgress: progress,
    };
    broadcast('status', runState);

    if (run.status !== 'completed') {
      return;
    }

    if (githubPollTimer) {
      clearInterval(githubPollTimer);
      githubPollTimer = null;
    }

    try {
      pushLog('Baixando logs do Playwright…', 'system');
      const logs = await fetchRunLogsText(runId);
      const lines = extractPlaywrightLogLines(logs);
      pushLog('─── Log Playwright (GitHub Actions) ───', 'system');
      for (const line of lines) {
        const stream = /✘|failed|error/i.test(line) ? 'stderr' : 'stdout';
        pushLog(line, stream);
      }
    } catch (err) {
      pushLog(`Logs indisponíveis: ${err.message}`, 'stderr');
    }

    try {
      pushLog('Baixando report do GitHub Actions…', 'system');
      await downloadRunArtifacts(runId, {
        reportDir: REPORT_DIR,
        resultsJson: RESULTS_JSON,
      });
      pushLog('Report disponível em /report/', 'system');
    } catch (err) {
      pushLog(`Erro ao baixar artifact: ${err.message}`, 'stderr');
    }

    const exitCode = run.conclusion === 'success' ? 0 : 1;
    finishRun(exitCode, {
      githubRepo: REPO_GITHUB(),
      githubRunId: runId,
      githubRunUrl: run.htmlUrl,
      githubActionsUrl: buildGithubActionsUrl(runId, run.htmlUrl),
      githubProgress: progress,
    });
  } catch (err) {
    pushLog(`Erro ao consultar GitHub Actions: ${err.message}`, 'stderr');
  }
}

function startGithubPolling(runId) {
  githubRunId = runId;
  lastGithubPollStatus = null;
  lastGithubStepsKey = null;
  if (githubPollTimer) clearInterval(githubPollTimer);
  void pollGithubRun(runId);
  githubPollTimer = setInterval(() => {
    void pollGithubRun(runId);
  }, 5_000);
}

async function startGithubRun(body) {
  if (runState.status === 'running') {
    return { ok: false, error: 'Já existe uma execução em andamento.' };
  }
  if (!githubConfigured()) {
    return {
      ok: false,
      error: 'GITHUB_TOKEN e GITHUB_REPO devem estar configurados para executar via GitHub Actions.',
    };
  }

  const target = body.target === 'local' ? 'local' : 'app';
  runState = {
    status: 'running',
    startedAt: new Date().toISOString(),
    exitCode: null,
    target,
    args: [],
    runner: 'github',
    githubRunUrl: null,
  };
  broadcast('status', runState);
  pushLog(`▶ Disparando GitHub Actions (${REPO_GITHUB()})…`, 'system');

  try {
    const dispatched = await dispatchWorkflow(body);
    runState = {
      ...runState,
      githubRepo: REPO_GITHUB(),
      githubRunId: dispatched.runId,
      githubRunUrl: dispatched.htmlUrl,
      githubActionsUrl: buildGithubActionsUrl(dispatched.runId, dispatched.htmlUrl),
    };
    saveGithubRunState({
      runId: dispatched.runId,
      htmlUrl: dispatched.htmlUrl,
      startedAt: runState.startedAt,
      target,
      inputs: dispatched.inputs,
    });
    pushLog(`Workflow #${dispatched.runId}: ${dispatched.htmlUrl}`, 'system');
    broadcast('status', runState);
    startGithubPolling(dispatched.runId);
    return { ok: true, run: runState };
  } catch (err) {
    runState = { status: 'idle', startedAt: null, exitCode: null, target: null, args: [], runner: 'github' };
    broadcast('status', runState);
    return { ok: false, error: err.message };
  }
}

async function prepareAndStartRun(body) {
  const mode = getRunnerMode();

  if (mode === 'github-unconfigured') {
    const msg = 'Configure GITHUB_TOKEN e GITHUB_REPO na Hostinger para executar testes via GitHub Actions.';
    pushLog(msg, 'stderr');
    return { ok: false, error: msg };
  }

  if (mode === 'github') {
    return startGithubRun(body);
  }

  if (isSharedHosting() && !usesRemoteBrowser()) {
    const msg =
      'Chromium não roda neste servidor (limite de processos da hospedagem). Configure GITHUB_TOKEN e GITHUB_REPO para executar via GitHub Actions.';
    pushLog(msg, 'stderr');
    return { ok: false, error: msg };
  }

  if (!browsersInstalled()) {
    pushLog('Chromium não encontrado. Baixando automaticamente (pode levar alguns minutos)…', 'system');
    broadcast('browsers', getBrowserStatus());
    const install = await ensureBrowsersInstalled((line) => pushLog(line, 'stdout'));
    broadcast('browsers', getBrowserStatus());
    if (!install.ok) {
      pushLog(install.error ?? 'Falha no download do Chromium', 'stderr');
      return { ok: false, error: install.error };
    }
    pushLog('Chromium instalado. Iniciando testes…', 'system');
  }

  return startRun(body);
}

function stopRun() {
  if (githubRunId) {
    void cancelWorkflowRun(githubRunId)
      .then(() => pushLog('■ Cancelamento solicitado no GitHub Actions', 'system'))
      .catch((err) => pushLog(`Erro ao cancelar workflow: ${err.message}`, 'stderr'));
    return { ok: true };
  }

  if (!activeProcess) {
    return { ok: false, error: 'Nenhuma execução ativa.' };
  }
  activeProcess.kill('SIGTERM');
  pushLog('■ Execução interrompida pelo usuário', 'system');
  return { ok: true };
}

function json(res, status, data, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(JSON.stringify(data));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (!session) {
    json(res, 401, { ok: false, error: 'Não autenticado.' });
    return null;
  }
  return session;
}

const PUBLIC_PATHS = new Set(['/login', '/login.html', '/login.css', '/login.js']);

function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const secure = isSecureRequest(req);
  const session = getSession(req);

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    try {
      const body = await readBody(req);
      const result = await platformLogin(body);
      if (!result.ok) {
        return json(res, result.mfaRequired ? 401 : 403, result);
      }
      const payload = createSessionPayload(result.token, result.usuario);
      return json(
        res,
        200,
        { ok: true, usuario: payload.usuario },
        { 'Set-Cookie': buildSessionCookie(payload, secure) }
      );
    } catch {
      return json(res, 400, { ok: false, error: 'JSON inválido' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie(secure) });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    if (!session) {
      return json(res, 401, { ok: false });
    }
    return json(res, 200, { ok: true, usuario: session.usuario });
  }

  if (url.pathname.startsWith('/api/')) {
    if (!requireAuth(req, res)) return;
  }

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const saved = loadGithubRunState();
    const activeRunId = githubRunId ?? saved?.runId ?? runState.githubRunId ?? null;
    const githubActionsUrl = buildGithubActionsUrl(
      activeRunId,
      runState.githubActionsUrl ?? runState.githubRunUrl ?? saved?.htmlUrl
    );
    return json(res, 200, {
      ...runState,
      runner: getRunnerMode(),
      githubConfigured: githubConfigured(),
      githubRepo: REPO_GITHUB(),
      githubRunId: activeRunId,
      githubActionsUrl,
      reportAvailable: reportAvailable(),
      results: loadResults(),
      browsers:
        getRunnerMode() === 'github'
          ? { runner: 'github', installed: true }
          : getRunnerMode() === 'github-unconfigured'
            ? { runner: 'github-unconfigured', installed: false }
            : getBrowserStatus(),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/browsers') {
    if (isGithubRunner()) {
      return json(res, 200, { runner: 'github', installed: true });
    }
    return json(res, 200, getBrowserStatus());
  }

  if (req.method === 'POST' && url.pathname === '/api/browsers/install') {
    if (isGithubRunner() || isSharedHosting()) {
      return json(res, 200, {
        ok: true,
        browsers: isGithubRunner()
          ? { runner: 'github', installed: true }
          : getBrowserStatus(),
      });
    }
    if (browsersInstalled()) {
      return json(res, 200, { ok: true, browsers: getBrowserStatus() });
    }
    if (getBrowserStatus().installing) {
      return json(res, 202, { ok: true, browsers: getBrowserStatus() });
    }
    void ensureBrowsersInstalled((line) => pushLog(line, 'stdout')).then((result) => {
      broadcast('browsers', getBrowserStatus());
      if (!result.ok) pushLog(result.error ?? 'Falha no download', 'stderr');
    });
    return json(res, 202, { ok: true, browsers: getBrowserStatus() });
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
      const result = await prepareAndStartRun(body);
      return json(res, result.ok ? 202 : 409, result);
    } catch {
      return json(res, 400, { ok: false, error: 'JSON inválido' });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/stop') {
    return json(res, 200, stopRun());
  }

  if (url.pathname === '/report' || url.pathname === '/report/') {
    if (!session) {
      return redirect(res, '/login');
    }
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
    if (!session) {
      return redirect(res, '/login');
    }
    const rel = decodeURIComponent(url.pathname.slice('/report/'.length));
    const filePath = path.normalize(path.join(REPORT_DIR, rel));
    if (!filePath.startsWith(REPORT_DIR)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    return serveFile(res, filePath);
  }

  if (url.pathname === '/login' || url.pathname === '/login.html') {
    return serveFile(res, path.join(PUBLIC_DIR, 'login.html'));
  }

  if (!session && !isPublicPath(url.pathname)) {
    if (url.pathname.startsWith('/api/')) {
      return json(res, 401, { ok: false, error: 'Não autenticado.' });
    }
    return redirect(res, '/login');
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
  const label = HOST === '0.0.0.0' ? 'localhost' : HOST;
  const runner = getRunnerMode();
  console.log(`E2E Dashboard: http://${label}:${port}`);
  console.log(`Login:         http://${label}:${port}/login`);
  console.log(`Report HTML:   http://${label}:${port}/report/`);
  console.log(`Runner:        ${runner}${runner === 'github' ? ` (${REPO_GITHUB()})` : ''}`);
  console.log(`Platform API:  ${PLATFORM_API_URL}`);
  if (HOST === '0.0.0.0') {
    console.log(`(escutando em 0.0.0.0:${port} — PORT=${PLATFORM_PORT ?? 'n/a'})`);
  }
}

function REPO_GITHUB() {
  return process.env.GITHUB_REPO?.trim() || 'kaiquesp/controle-dental-playwright';
}

function resumeGithubRunIfNeeded() {
  const saved = loadGithubRunState();
  if (!saved?.runId || !isGithubRunner()) return;

  runState = {
    status: 'running',
    startedAt: saved.startedAt ?? new Date().toISOString(),
    exitCode: null,
    target: saved.target ?? 'app',
    args: [],
    runner: 'github',
    githubRepo: REPO_GITHUB(),
    githubRunId: saved.runId,
    githubRunUrl: saved.htmlUrl ?? null,
    githubActionsUrl: buildGithubActionsUrl(saved.runId, saved.htmlUrl),
  };
  broadcast('status', runState);
  pushLog(`Retomando acompanhamento do workflow #${saved.runId}…`, 'system');
  startGithubPolling(saved.runId);
}

async function probeDashboard(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${port}/login`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
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

export async function startDashboard() {
  for (let i = 0; i < PORT_ATTEMPTS; i++) {
    const port = DEFAULT_PORT + i;
    try {
      const bound = await listen(port);
      printBanner(bound);
      resumeGithubRunIfNeeded();
      if (!isGithubRunner() && !browsersInstalled() && !isSharedHosting()) {
        console.log('[e2e-dashboard] Chromium ausente — download automático em segundo plano.');
        void ensureBrowsersInstalled((line) => {
          console.log(`[playwright install] ${line}`);
        }).then(() => broadcast('browsers', getBrowserStatus()));
      }
      return bound;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') {
        console.error(err);
        process.exit(1);
      }
      if (PLATFORM_PORT) {
        console.error(`Porta ${PLATFORM_PORT} em uso (variável PORT). Encerre o processo anterior.`);
        process.exit(1);
      }
      const isDashboard = await probeDashboard(port);
      if (isDashboard) {
        console.log(`Dashboard já está em execução: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${port}`);
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
}

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  void startDashboard();
}

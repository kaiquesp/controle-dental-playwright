import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const GITHUB_API = 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN?.trim() ?? '';
const REPO = process.env.GITHUB_REPO?.trim() || 'kaiquesp/controle-dental-playwright';
const WORKFLOW_FILE = process.env.GITHUB_WORKFLOW_FILE?.trim() || 'playwright.yml';
const REF = process.env.GITHUB_WORKFLOW_REF?.trim() || 'main';
const STATE_FILE = path.join(ROOT, '.cache', 'github-run-state.json');

export function getRunnerMode() {
  if (process.env.E2E_RUNNER === 'local') return 'local';
  if (process.env.E2E_RUNNER === 'github') return 'github';
  if (TOKEN) return 'github';
  return 'local';
}

export function isGithubRunner() {
  return getRunnerMode() === 'github';
}

export function githubConfigured() {
  return Boolean(TOKEN && REPO);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ghFetch(apiPath, options = {}) {
  if (!TOKEN) {
    throw new Error('GITHUB_TOKEN não configurado.');
  }

  const res = await fetch(`${GITHUB_API}${apiPath}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function loadGithubRunState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}

export function saveGithubRunState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function clearGithubRunState() {
  try {
    fs.unlinkSync(STATE_FILE);
  } catch {
    /* ignore */
  }
}

export async function dispatchWorkflow(body) {
  const inputs = {
    target: body.target === 'local' ? 'local' : 'app',
    project: body.project?.trim() || 'authenticated',
    grep: body.grep?.trim() || '',
    workers: String(body.workers ?? 1),
  };

  const dispatchedAt = new Date(Date.now() - 10_000).toISOString();

  await ghFetch(`/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: REF, inputs }),
  });

  for (let attempt = 0; attempt < 18; attempt++) {
    await sleep(attempt < 3 ? 3000 : 5000);
    const data = await ghFetch(
      `/repos/${REPO}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=10`
    );
    const run = (data.workflow_runs ?? []).find((item) => item.created_at >= dispatchedAt);
    if (run) {
      return {
        runId: run.id,
        htmlUrl: run.html_url,
        inputs,
      };
    }
  }

  throw new Error('Workflow disparado, mas o run não apareceu no GitHub Actions a tempo.');
}

export async function fetchRunStatus(runId) {
  const run = await ghFetch(`/repos/${REPO}/actions/runs/${runId}`);
  return {
    status: run.status,
    conclusion: run.conclusion,
    htmlUrl: run.html_url,
  };
}

export async function cancelWorkflowRun(runId) {
  await ghFetch(`/repos/${REPO}/actions/runs/${runId}/cancel`, { method: 'POST' });
}

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) rimraf(full);
    else fs.unlinkSync(full);
  }
  fs.rmdirSync(dir);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell',
      ['-NoProfile', '-Command', `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`],
      { stdio: 'pipe' }
    );
    if (result.status !== 0) {
      throw new Error(result.stderr?.toString() || 'Falha ao extrair zip no Windows.');
    }
    return;
  }

  const unzip = spawnSync('unzip', ['-o', zipPath, '-d', destDir], { stdio: 'pipe' });
  if (unzip.status === 0) return;

  const python = spawnSync('python3', ['-m', 'zipfile', '-e', zipPath, destDir], { stdio: 'pipe' });
  if (python.status === 0) return;

  throw new Error('Não foi possível extrair o artifact (unzip/python3 indisponíveis).');
}

export async function downloadRunArtifacts(runId, { reportDir, resultsJson }) {
  const data = await ghFetch(`/repos/${REPO}/actions/runs/${runId}/artifacts`);
  const artifact = (data.artifacts ?? []).find((item) => item.name === 'playwright-report');
  if (!artifact) {
    throw new Error('Artifact "playwright-report" não encontrado neste run.');
  }

  const zipRes = await fetch(artifact.archive_download_url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!zipRes.ok) {
    throw new Error(`Download do artifact falhou (${zipRes.status}).`);
  }

  const cacheDir = path.join(ROOT, '.cache', 'gh-artifacts');
  const zipPath = path.join(cacheDir, `run-${runId}.zip`);
  const extractDir = path.join(cacheDir, `run-${runId}`);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(zipPath, Buffer.from(await zipRes.arrayBuffer()));

  rimraf(extractDir);
  extractZip(zipPath, extractDir);

  const srcReport = path.join(extractDir, 'playwright-report');
  const srcResults = path.join(extractDir, 'test-results', 'results.json');

  if (fs.existsSync(srcReport)) {
    rimraf(reportDir);
    copyDir(srcReport, reportDir);
  }

  if (fs.existsSync(srcResults)) {
    fs.mkdirSync(path.dirname(resultsJson), { recursive: true });
    fs.copyFileSync(srcResults, resultsJson);
  }

  try {
    fs.unlinkSync(zipPath);
  } catch {
    /* ignore */
  }
}

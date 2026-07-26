const $ = (sel) => document.querySelector(sel);

const statusPill = $('#status-pill');
const btnRun = $('#btn-run');
const btnStop = $('#btn-stop');
const btnClearLog = $('#btn-clear-log');
const btnLogout = $('#btn-logout');
const userPill = $('#user-pill');
const logEl = $('#log');
const form = $('#run-form');
const linkReport = $('#link-report');
const browserBanner = $('#browser-banner');
const githubProgressCard = $('#github-progress-card');
const githubSteps = $('#github-steps');
const btnGithubLive = $('#btn-github-live');

const fetchOpts = { credentials: 'same-origin' };
let lastBrowserState = null;

function stepIcon(step) {
  if (step.status === 'in_progress') return '◌';
  if (step.status === 'queued') return '○';
  if (step.conclusion === 'success' || step.conclusion === 'skipped') return '✓';
  if (step.conclusion === 'failure' || step.conclusion === 'cancelled') return '✗';
  return '·';
}

function renderGithubProgress(payload) {
  const url = payload?.htmlUrl ?? payload?.githubRunUrl ?? null;
  const progress = payload?.progress ?? payload?.githubProgress ?? payload;
  const steps = progress?.steps ?? [];

  if (url) {
    btnGithubLive.href = url;
    btnGithubLive.hidden = false;
  } else {
    btnGithubLive.hidden = true;
  }

  if (!steps.length && !url) {
    githubProgressCard.classList.add('hidden');
    return;
  }

  githubProgressCard.classList.remove('hidden');
  githubSteps.innerHTML = steps
    .map(
      (step) => `
      <li class="github-step" data-status="${step.status}" data-conclusion="${step.conclusion ?? ''}">
        <span class="github-step__icon">${stepIcon(step)}</span>
        <span class="github-step__name">${escapeHtml(step.name)}</span>
      </li>`
    )
    .join('');
}

function renderBrowserStatus(browsers) {
  lastBrowserState = browsers;
  if (!browsers) {
    browserBanner.classList.add('hidden');
    return;
  }

  if (browsers.runner === 'github') {
    browserBanner.classList.remove('hidden');
    browserBanner.dataset.state = 'ready';
    browserBanner.textContent =
      'Testes executados via GitHub Actions. O report será baixado automaticamente ao concluir.';
    btnRun.disabled = false;
    return;
  }

  if (browsers.runner === 'github-unconfigured') {
    browserBanner.classList.remove('hidden');
    browserBanner.dataset.state = 'error';
    browserBanner.textContent =
      'GITHUB_TOKEN não configurado na Hostinger. Adicione o token e GITHUB_REPO nas variáveis de ambiente e reinicie a aplicação.';
    btnRun.disabled = true;
    return;
  }

  if (browsers.remote) {
    browserBanner.classList.remove('hidden');
    browserBanner.dataset.state = 'ready';
    browserBanner.textContent = `Browser remoto: ${browsers.remoteEndpoint ?? 'configurado'}. Chromium local não é necessário.`;
    btnRun.disabled = false;
    return;
  }

  if (browsers.hostingWarning) {
    browserBanner.classList.remove('hidden');
    browserBanner.dataset.state = 'error';
    browserBanner.textContent =
      'Configure GITHUB_TOKEN na Hostinger para executar via GitHub Actions, ou PLAYWRIGHT_WS_ENDPOINT para browser remoto.';
    btnRun.disabled = false;
    return;
  }

  if (browsers.installed) {
    browserBanner.classList.add('hidden');
    btnRun.disabled = false;
    return;
  }

  browserBanner.classList.remove('hidden');
  if (browsers.installing) {
    browserBanner.dataset.state = 'installing';
    browserBanner.textContent =
      'Baixando o Chromium automaticamente (primeira vez). Pode levar alguns minutos — acompanhe no log abaixo.';
    btnRun.disabled = true;
    return;
  }

  if (browsers.error) {
    browserBanner.dataset.state = 'error';
    browserBanner.textContent = `${browsers.error} Clique em "Rodar testes" para tentar novamente.`;
    btnRun.disabled = false;
    return;
  }

  browserBanner.dataset.state = 'installing';
  browserBanner.textContent =
    'Chromium ainda não instalado. Ao clicar em "Rodar testes", o download começa automaticamente.';
  btnRun.disabled = false;
}

async function ensureAuth() {
  const res = await fetch('/api/auth/me', fetchOpts);
  if (!res.ok) {
    window.location.replace('/login');
    return null;
  }
  const data = await res.json();
  const name = data.usuario?.name?.trim() || data.usuario?.email || 'Super Admin';
  userPill.textContent = name;
  userPill.hidden = false;
  return data.usuario;
}

btnLogout.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', ...fetchOpts });
  window.location.replace('/login');
});

const PRESETS = {
  authenticated: { project: 'authenticated', grep: '', workers: 1 },
  public: { project: 'public', grep: '', workers: 1 },
  setup: { project: 'setup', grep: '', workers: 1 },
  pacientes: { project: 'authenticated', grep: 'PAC-', workers: 1 },
  agenda: { project: 'authenticated', grep: 'AG-', workers: 1 },
  prontuario: { project: 'authenticated', grep: 'PAC-PRONT-', workers: 1 },
};

function formatDuration(ms) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m ? `${m}m ${rest}s` : `${rest}s`;
}

function appendLog(line, stream = 'stdout') {
  const span = document.createElement('span');
  span.className = stream;
  span.textContent = `${line}\n`;
  logEl.appendChild(span);
  logEl.scrollTop = logEl.scrollHeight;
}

function setRunning(running) {
  btnRun.disabled = running || Boolean(lastBrowserState?.installing);
  btnStop.disabled = !running;
  form.querySelectorAll('input, select').forEach((el) => {
    if (el.id !== 'headed') el.disabled = running;
  });
}

function setStatus(state, label) {
  statusPill.dataset.state = state;
  statusPill.textContent = label;
}

function renderResults(data) {
  const stats = data?.stats;
  $('#stat-pass').textContent = stats ? String(stats.expected ?? 0) : '—';
  $('#stat-fail').textContent = stats ? String((stats.unexpected ?? 0) + (stats.flaky ?? 0)) : '—';
  $('#stat-skip').textContent = stats ? String(stats.skipped ?? 0) : '—';
  $('#stat-duration').textContent = stats ? formatDuration(stats.duration) : '—';

  const meta = $('#results-meta');
  if (!data?.available) {
    meta.textContent = data?.error ? `Erro ao ler resultados: ${data.error}` : 'Nenhum resultado em test-results/results.json.';
  } else {
    meta.textContent = `Atualizado em ${new Date(data.generatedAt).toLocaleString('pt-BR')} — ${data.tests.length} teste(s)`;
  }

  const tbody = $('#tests-body');
  tbody.innerHTML = '';
  if (!data?.tests?.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty">Sem testes no último report JSON.</td></tr>';
    return;
  }

  for (const test of data.tests) {
    const tr = document.createElement('tr');
    const status = test.status === 'expected' ? 'passed' : test.status;
    tr.innerHTML = `
      <td><span class="badge ${status}">${status}</span></td>
      <td>${escapeHtml(test.title)}${test.error ? `<br><small style="color:#ff9f9f">${escapeHtml(test.error)}</small>` : ''}</td>
      <td>${formatDuration(test.duration)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function refreshStatus() {
  const res = await fetch('/api/status', fetchOpts);
  if (res.status === 401) {
    window.location.replace('/login');
    return;
  }
  const data = await res.json();
  if (data.runner === 'github-unconfigured' || data.runner === 'github') {
    $('#headed-wrap').hidden = true;
  }
  renderBrowserStatus(data.browsers);
  renderResults(data.results);
  if (data.runner === 'github' && (data.githubProgress?.steps?.length || data.githubRunUrl)) {
    renderGithubProgress(data);
  }
  linkReport.classList.toggle('disabled', !data.reportAvailable);
  if (data.status === 'running') {
    setRunning(true);
    setStatus('running', data.runner === 'github' ? 'GitHub Actions…' : 'Executando…');
  } else if (data.exitCode === 0) {
    setRunning(false);
    setStatus('done-ok', 'Concluído ✓');
  } else if (data.exitCode != null) {
    setRunning(false);
    setStatus('done-fail', `Falhou (${data.exitCode})`);
  } else {
    setRunning(false);
    setStatus('idle', 'Ocioso');
  }
}

function readForm() {
  return {
    target: $('#target').value,
    project: $('#project').value,
    grep: $('#grep').value.trim(),
    headed: $('#headed').checked,
    workers: Number($('#workers').value) || 1,
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setRunning(true);
  setStatus('running', 'Iniciando…');
  appendLog('Solicitando execução…', 'system');

  const res = await fetch('/api/run', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(readForm()),
  });
  const data = await res.json();
  if (!data.ok) {
    appendLog(data.error ?? 'Falha ao iniciar', 'stderr');
    setRunning(false);
    setStatus('idle', 'Ocioso');
  }
});

btnStop.addEventListener('click', async () => {
  await fetch('/api/stop', { method: 'POST', credentials: 'same-origin' });
});

btnClearLog.addEventListener('click', () => {
  logEl.innerHTML = '';
});

document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = PRESETS[btn.dataset.preset];
    if (!preset) return;
    $('#project').value = preset.project;
    $('#grep').value = preset.grep;
    $('#workers').value = String(preset.workers);
  });
});

const events = new EventSource('/api/events');
events.addEventListener('log', (ev) => {
  const { line, stream } = JSON.parse(ev.data);
  appendLog(line, stream);
});
events.addEventListener('status', (ev) => {
  const data = JSON.parse(ev.data);
  if (data.runner === 'github' && (data.githubProgress?.steps?.length || data.githubRunUrl)) {
    renderGithubProgress(data);
  }
  if (data.status === 'running') {
    setRunning(true);
    setStatus('running', data.runner === 'github' ? 'GitHub Actions…' : 'Executando…');
  } else if (data.exitCode === 0) {
    setRunning(false);
    setStatus('done-ok', 'Concluído ✓');
  } else if (data.exitCode != null) {
    setRunning(false);
    setStatus('done-fail', `Falhou (${data.exitCode})`);
  }
});
events.addEventListener('results', (ev) => {
  renderResults(JSON.parse(ev.data));
});
events.addEventListener('browsers', (ev) => {
  renderBrowserStatus(JSON.parse(ev.data));
});
events.addEventListener('github-progress', (ev) => {
  renderGithubProgress(JSON.parse(ev.data));
});

refreshStatus();
void ensureAuth();

if (document.visibilityState === 'visible') {
  setInterval(() => {
    if (document.visibilityState === 'visible') refreshStatus();
  }, 5000);
}

import fs from 'node:fs';
import {
  browsersInstalled as localBrowsersInstalled,
  PLAYWRIGHT_BROWSERS_PATH,
  spawnPlaywright,
} from './playwright-cli.mjs';
import { getRemoteBrowserEndpoint, maskWsEndpoint, usesRemoteBrowser, isSharedHosting } from './playwright-remote.mjs';

function browsersInstalled() {
  return usesRemoteBrowser() || localBrowsersInstalled();
}

export { browsersInstalled };

/** @type {Promise<{ ok: boolean; error?: string }> | null} */
let installPromise = null;

/** @type {{ installed: boolean; installing: boolean; error: string | null }} */
let lastState = {
  installed: browsersInstalled(),
  installing: false,
  error: null,
};

function refreshState(patch = {}) {
  lastState = {
    installed: browsersInstalled(),
    installing: Boolean(installPromise),
    error: lastState.error,
    ...patch,
  };
  return lastState;
}

export function getBrowserStatus() {
  refreshState();
  const remote = usesRemoteBrowser();
  return {
    ...lastState,
    installed: browsersInstalled(),
    remote,
    remoteEndpoint: remote ? maskWsEndpoint(getRemoteBrowserEndpoint()) : null,
    hostingWarning: isSharedHosting() && !remote,
    path: PLAYWRIGHT_BROWSERS_PATH,
  };
}

/**
 * @param {(line: string) => void} [onLog]
 */
export function ensureBrowsersInstalled(onLog) {
  if (usesRemoteBrowser()) {
    refreshState({ error: null, installing: false });
    return Promise.resolve({ ok: true });
  }

  if (isSharedHosting()) {
    const error =
      'Chromium não pode ser instalado nem executado em hospedagem compartilhada. Configure GITHUB_TOKEN (GitHub Actions) ou PLAYWRIGHT_WS_ENDPOINT (browser remoto).';
    refreshState({ installing: false, error });
    return Promise.resolve({ ok: false, error });
  }

  if (browsersInstalled()) {
    refreshState({ error: null });
    return Promise.resolve({ ok: true });
  }

  if (installPromise) {
    return installPromise;
  }

  fs.mkdirSync(PLAYWRIGHT_BROWSERS_PATH, { recursive: true });
  refreshState({ installing: true, error: null });

  installPromise = new Promise((resolve) => {
    const child = spawnPlaywright(['install', 'chromium'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const forward = (chunk) => {
      const text = chunk.toString();
      if (onLog) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim()) onLog(line);
        }
      }
    };

    child.stdout?.on('data', forward);
    child.stderr?.on('data', forward);

    child.on('error', (err) => {
      installPromise = null;
      refreshState({ installing: false, error: err.message });
      resolve({ ok: false, error: `Erro ao iniciar download: ${err.message}` });
    });

    child.on('close', (code) => {
      installPromise = null;
      if (code === 0 && browsersInstalled()) {
        refreshState({ installing: false, error: null });
        resolve({ ok: true });
        return;
      }
      const error =
        'Falha ao baixar o Chromium. O servidor pode não ter espaço em disco ou bibliotecas necessárias.';
      refreshState({ installing: false, error });
      resolve({ ok: false, error });
    });
  });

  return installPromise;
}

export function startBackgroundBrowserInstall() {
  if (browsersInstalled() || installPromise) return;
  void ensureBrowsersInstalled((line) => {
    console.log(`[playwright install] ${line}`);
  }).then((result) => {
    if (result.ok) {
      console.log('[e2e-dashboard] Chromium instalado com sucesso.');
    } else {
      console.warn('[e2e-dashboard] Download do Chromium falhou:', result.error);
    }
  });
}

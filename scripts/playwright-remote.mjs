export function usesRemoteBrowser() {
  return Boolean(process.env.PLAYWRIGHT_WS_ENDPOINT?.trim());
}

export function getRemoteBrowserEndpoint() {
  return process.env.PLAYWRIGHT_WS_ENDPOINT?.trim() ?? '';
}

export function maskWsEndpoint(url) {
  try {
    const normalized = url.replace(/^ws(s)?:\/\//, 'http://');
    const parsed = new URL(normalized);
    const scheme = url.startsWith('wss://') ? 'wss' : 'ws';
    return `${scheme}://${parsed.host}/***`;
  } catch {
    return '(configurado)';
  }
}

export function isSharedHosting() {
  if (process.env.E2E_HOSTED === '1' || process.env.E2E_HOSTED === 'true') return true;
  if (process.env.PORT) return true;

  const markers = [process.cwd(), process.env.HOME ?? '', process.env.PWD ?? ''].join('\n');
  if (/\/domains\/[^/]+\//.test(markers)) return true;
  if (/hostinger|\.hstgr\.cloud/i.test(markers)) return true;

  return false;
}

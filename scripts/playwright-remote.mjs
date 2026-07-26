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
  return Boolean(process.env.PORT);
}

import crypto from 'node:crypto';

export const SESSION_COOKIE = 'e2e_dashboard_session';
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export const PLATFORM_API_URL =
  process.env.PLATFORM_API_URL?.replace(/\/$/, '') ??
  'https://api.controledental.com.br/api/platform';

const SESSION_SECRET =
  process.env.E2E_DASHBOARD_SESSION_SECRET?.trim() ||
  (process.env.NODE_ENV === 'production' ? null : 'e2e-dashboard-dev-secret');

if (!SESSION_SECRET) {
  console.warn(
    '[e2e-dashboard] Defina E2E_DASHBOARD_SESSION_SECRET em produção para assinar sessões.'
  );
}

function signPayload(payload) {
  const secret = SESSION_SECRET ?? 'e2e-dashboard-dev-secret';
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyPayload(token) {
  if (!token) return null;
  const secret = SESSION_SECRET ?? 'e2e-dashboard-dev-secret';
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    if (payload.usuario?.role !== 'super_admin') return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie ?? '';
  const cookies = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function getSession(req) {
  const cookies = parseCookies(req);
  return verifyPayload(cookies[SESSION_COOKIE]);
}

export function buildSessionCookie(payload, secure) {
  const token = signPayload(payload);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(secure) {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function isSecureRequest(req) {
  if (req.headers['x-forwarded-proto'] === 'https') return true;
  return Boolean(process.env.PORT);
}

export async function platformLogin({ email, senha, totp }) {
  const body = { email: email.trim().toLowerCase(), senha };
  if (totp?.trim()) body.totp = totp.trim();

  let res;
  try {
    res = await fetch(`${PLATFORM_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: `Não foi possível contatar a API: ${err.message}` };
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401 && data.mfaRequired) {
      return {
        ok: false,
        mfaRequired: true,
        error: data.message ?? data.erro ?? 'Informe o código do autenticador (MFA).',
      };
    }
    return { ok: false, error: data.erro ?? data.message ?? 'Credenciais inválidas.' };
  }

  if (data.usuario?.role !== 'super_admin') {
    return { ok: false, error: 'Acesso restrito a super administradores da plataforma.' };
  }

  return { ok: true, token: data.token, usuario: data.usuario };
}

export function createSessionPayload(token, usuario) {
  return {
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      name: usuario.name,
      role: usuario.role,
    },
    exp: Date.now() + SESSION_MAX_AGE_MS,
  };
}

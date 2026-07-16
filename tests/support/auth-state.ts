import fs from 'fs';
import path from 'path';
import { e2eEnv } from './env';

const AUTH_DIR = path.resolve(__dirname, '../../playwright/.auth');
const LEGACY_AUTH_FILE = path.resolve(AUTH_DIR, 'user.json');
const TOKEN_KEY = 'accessToken';

function resolveAuthFile(): string {
  const targetFile = path.resolve(AUTH_DIR, `user-${e2eEnv.target}.json`);
  if (fs.existsSync(targetFile)) {
    return targetFile;
  }
  if (e2eEnv.target === 'app' && fs.existsSync(LEGACY_AUTH_FILE)) {
    return LEGACY_AUTH_FILE;
  }
  return targetFile;
}

const AUTH_FILE = resolveAuthFile();

export function authFileHasToken(filePath = AUTH_FILE): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
      origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
    };

    return Boolean(
      state.origins?.some((origin) =>
        origin.localStorage?.some((item) => item.name === TOKEN_KEY && item.value.length > 0)
      )
    );
  } catch {
    return false;
  }
}

export function authFileIsFresh(maxAgeHours = 12, filePath = AUTH_FILE): boolean {
  if (!authFileHasToken(filePath)) {
    return false;
  }

  const stats = fs.statSync(filePath);
  const ageMs = Date.now() - stats.mtimeMs;
  return ageMs < maxAgeHours * 60 * 60 * 1000;
}

export { AUTH_FILE, TOKEN_KEY };

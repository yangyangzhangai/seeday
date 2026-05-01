import { spawnSync } from 'node:child_process';

const rawApiBase = String(process.env.VITE_API_BASE ?? '').trim();

if (!rawApiBase) {
  console.error(
    '[build:ios] Missing VITE_API_BASE. Example: VITE_API_BASE=https://seedayapp.com/api npm run build:ios',
  );
  process.exit(1);
}

let normalizedApiBase = rawApiBase.replace(/\/+$/, '');

if (!/^https?:\/\//i.test(normalizedApiBase)) {
  console.error(
    `[build:ios] VITE_API_BASE must be an absolute URL, got: ${rawApiBase}`,
  );
  process.exit(1);
}

// Auto-append /api if the URL looks like a bare domain (no path component beyond /)
// e.g. https://seedayapp.com → https://seedayapp.com/api
const parsedUrl = new URL(normalizedApiBase);
if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
  normalizedApiBase = `${normalizedApiBase}/api`;
  console.warn(
    `[build:ios] VITE_API_BASE looks like a bare domain. Auto-appending /api → ${normalizedApiBase}`,
  );
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const result = spawnSync(npmCmd, ['run', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_BASE: normalizedApiBase,
  },
});

if (result.error) {
  console.error(`[build:ios] Failed to run npm build: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);

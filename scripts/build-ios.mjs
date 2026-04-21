import { spawnSync } from 'node:child_process';

const rawApiBase = String(process.env.VITE_API_BASE ?? '').trim();

if (!rawApiBase) {
  console.error(
    '[build:ios] Missing VITE_API_BASE. Example: VITE_API_BASE=https://your-project.vercel.app npm run build:ios',
  );
  process.exit(1);
}

const normalizedApiBase = rawApiBase.replace(/\/+$/, '');

if (!/^https?:\/\//i.test(normalizedApiBase)) {
  console.error(
    `[build:ios] VITE_API_BASE must be an absolute URL, got: ${rawApiBase}`,
  );
  process.exit(1);
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

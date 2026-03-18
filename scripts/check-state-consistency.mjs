import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const REQUIRED_GLOBAL_DOCS = [
  'docs/CHANGELOG.md',
];

const FEATURE_README_MAP = {
  'src/features/auth/': 'src/features/auth/README.md',
  'src/features/chat/': 'src/features/chat/README.md',
  'src/features/growth/': 'src/features/growth/GrowthPage.tsx',
  'src/features/report/': 'src/features/report/README.md',
  'src/api/': 'src/api/README.md',
  'api/': 'src/api/README.md',
};

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

function normalizePath(value) {
  return value.replace(/\\/g, '/').trim();
}

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

function getChangedFiles() {
  const tracked = runCommand('git diff --name-only HEAD');
  const untracked = runCommand('git ls-files --others --exclude-standard');
  const all = `${tracked}\n${untracked}`
    .split(/\r?\n/)
    .map(normalizePath)
    .filter(Boolean);

  return Array.from(new Set(all));
}

function isCodePath(filePath) {
  if (!(filePath.startsWith('src/') || filePath.startsWith('api/'))) {
    return false;
  }

  const ext = filePath.slice(filePath.lastIndexOf('.'));
  return CODE_EXTENSIONS.has(ext);
}

function collectRequiredModuleDocs(changedCodeFiles) {
  const required = new Set();

  for (const filePath of changedCodeFiles) {
    for (const [prefix, readmePath] of Object.entries(FEATURE_README_MAP)) {
      if (filePath.startsWith(prefix)) {
        required.add(readmePath);
      }
    }
  }

  return Array.from(required);
}

function main() {
  if (!existsSync('.git')) {
    console.log('[state-consistency] No .git directory found, skip check.');
    return;
  }

  const changedFiles = getChangedFiles();
  const changedSet = new Set(changedFiles);
  const changedCodeFiles = changedFiles.filter(isCodePath);

  if (changedCodeFiles.length === 0) {
    console.log('[state-consistency] No src/api code changes detected. Passed.');
    return;
  }

  const requiredModuleDocs = collectRequiredModuleDocs(changedCodeFiles);
  const requiredDocs = [...REQUIRED_GLOBAL_DOCS, ...requiredModuleDocs];
  const missing = requiredDocs.filter(docPath => !changedSet.has(docPath));

  if (missing.length > 0) {
    console.error('[state-consistency] Failed. Code changed without required state/doc updates.');
    console.error('');
    console.error('Changed code files:');
    for (const filePath of changedCodeFiles) {
      console.error(`  - ${filePath}`);
    }
    console.error('');
    console.error('Missing required updates:');
    for (const filePath of missing) {
      console.error(`  - ${filePath}`);
    }
    console.error('');
    console.error('Please update the missing docs, then run the check again.');
    process.exit(1);
  }

  console.log('[state-consistency] Passed. Code and changelog are updated together.');
}

main();

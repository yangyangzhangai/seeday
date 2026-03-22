import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const WARNING_LIMIT = 400;
const ERROR_LIMIT = 1000;
const ROOT_DIRS = ['src', 'api'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.vercel']);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function getLineCount(content) {
  if (!content) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

async function analyzeFile(filePath) {
  const content = await readFile(filePath, 'utf8');
  const lineCount = getLineCount(content);
  return { filePath, lineCount };
}

function toRelative(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, '/');
}

async function main() {
  const existingRoots = [];

  for (const rootDir of ROOT_DIRS) {
    const fullPath = path.join(process.cwd(), rootDir);
    try {
      const metadata = await stat(fullPath);
      if (metadata.isDirectory()) {
        existingRoots.push(fullPath);
      }
    } catch {
      // ignore missing directories
    }
  }

  if (existingRoots.length === 0) {
    console.log('[max-lines] No target directories found.');
    return;
  }

  const allFiles = [];
  for (const root of existingRoots) {
    allFiles.push(...(await collectFiles(root)));
  }

  const results = await Promise.all(allFiles.map(analyzeFile));
  results.sort((a, b) => b.lineCount - a.lineCount);

  const warnings = results.filter(item => item.lineCount > WARNING_LIMIT && item.lineCount <= ERROR_LIMIT);
  const errors = results.filter(item => item.lineCount > ERROR_LIMIT);

  console.log(`[max-lines] Checked ${results.length} files. warning>${WARNING_LIMIT}, error>${ERROR_LIMIT}.`);

  if (warnings.length > 0) {
    console.log('\nWarnings:');
    for (const item of warnings) {
      console.log(`  - ${toRelative(item.filePath)} (${item.lineCount} lines)`);
    }
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const item of errors) {
      console.log(`  - ${toRelative(item.filePath)} (${item.lineCount} lines)`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\n[max-lines] Passed (no files exceeded error limit).');
}

main().catch(error => {
  console.error('[max-lines] Failed:', error);
  process.exitCode = 1;
});

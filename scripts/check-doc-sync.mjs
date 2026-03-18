import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredDocs = [
  'LLM.md',
  'docs/CURRENT_TASK.md',
  'docs/PROJECT_MAP.md',
  'src/features/auth/README.md',
  'src/features/chat/README.md',
  'src/features/growth/GrowthPage.tsx',
  'src/features/report/README.md',
  'src/api/README.md',
];

const dependencyHeaderFiles = [
  'src/api/client.ts',
  'src/store/useChatStore.ts',
  'src/store/useMoodStore.ts',
  'src/store/useAuthStore.ts',
  'src/store/useAnnotationStore.ts',
  'src/store/useStardustStore.ts',
  'src/store/useReportStore.ts',
  'src/store/useTodoStore.ts',
  'api/chat.ts',
  'api/report.ts',
  'api/annotation.ts',
  'api/classify.ts',
  'api/diary.ts',
  'api/stardust.ts',
  'api/http.ts',
  'src/App.tsx',
];

const projectMapCoverageTokens = [
  'src/features/auth',
  'src/features/chat',
  'src/features/growth',
  'src/features/report',
  'src/api/',
  'api/',
  'src/store/',
  'src/i18n/',
];

function resolvePath(relPath) {
  return path.join(root, relPath);
}

async function fileExists(relPath) {
  try {
    await fs.access(resolvePath(relPath));
    return true;
  } catch {
    return false;
  }
}

async function readUtf8(relPath) {
  return fs.readFile(resolvePath(relPath), 'utf8');
}

function hasDependencyHeader(content) {
  const head = content.split(/\r?\n/).slice(0, 20).join('\n');
  return head.includes('DOC-DEPS:');
}

async function main() {
  const errors = [];

  for (const relPath of requiredDocs) {
    if (!(await fileExists(relPath))) {
      errors.push(`Missing required doc: ${relPath}`);
    }
  }

  for (const relPath of dependencyHeaderFiles) {
    if (!(await fileExists(relPath))) {
      errors.push(`Missing key file for dependency header check: ${relPath}`);
      continue;
    }

    const content = await readUtf8(relPath);
    if (!hasDependencyHeader(content)) {
      errors.push(`Missing DOC-DEPS header in key file: ${relPath}`);
    }
  }

  const projectMapPath = 'docs/PROJECT_MAP.md';
  if (await fileExists(projectMapPath)) {
    const projectMap = await readUtf8(projectMapPath);
    for (const token of projectMapCoverageTokens) {
      if (!projectMap.includes(token)) {
        errors.push(`PROJECT_MAP missing core coverage token: ${token}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('doc-sync check failed:\n');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('doc-sync check passed');
}

main().catch((error) => {
  console.error('doc-sync check crashed');
  console.error(error);
  process.exit(1);
});

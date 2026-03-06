/**
 * check-secrets.mjs
 * 扫描 staged 文件（或全仓）中的密钥泄露模式。
 * 用法：
 *   node ./scripts/check-secrets.mjs            → 扫描 git staged 文件
 *   node ./scripts/check-secrets.mjs --all      → 扫描全仓
 */

import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';

// 密钥检测规则：[正则, 说明]
const SECRET_PATTERNS = [
    [/sk-[a-zA-Z0-9]{20,}/, 'OpenAI/Qwen style secret key (sk-...)'],
    [/cpk_[a-zA-Z0-9]{20,}/, 'Chutes API key (cpk_...)'],
    [/Bearer\s+[a-zA-Z0-9_\-]{30,}/, 'Hardcoded Bearer token'],
    [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']{20,}["']/, 'Supabase service role key literal'],
    [/zhipuai.*["'][a-zA-Z0-9_\-.]{20,}["']/, 'Zhipu AI key literal'],
];

// 允许存在这些模式的路径（白名单）
const ALLOWLIST_PATHS = [
    '.env.example',
    'docs/',
    'scripts/check-secrets.mjs', // 本文件本身
];

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.env']);
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.git', '.vercel']);

function isAllowlisted(filePath) {
    const normalized = filePath.replace(/\\/g, '/');
    return ALLOWLIST_PATHS.some(p => normalized.includes(p));
}

function getStagedFiles() {
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return output.split(/\r?\n/).map(f => f.trim()).filter(Boolean);
    } catch {
        return [];
    }
}

async function collectAllFiles(dir) {
    const { readdir, stat } = await import('node:fs/promises');
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectAllFiles(fullPath)));
        } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }
    return files;
}

async function scanFile(filePath) {
    const content = await readFile(filePath, 'utf8').catch(() => null);
    if (!content) return [];

    const findings = [];
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const [pattern, description] of SECRET_PATTERNS) {
            if (pattern.test(line)) {
                findings.push({
                    file: filePath,
                    line: i + 1,
                    description,
                    snippet: line.trim().slice(0, 80),
                });
            }
        }
    }

    return findings;
}

async function main() {
    const scanAll = process.argv.includes('--all');
    const root = process.cwd();

    let filesToScan = [];

    if (scanAll) {
        filesToScan = await collectAllFiles(root);
    } else {
        // default: only staged files
        const staged = getStagedFiles();
        filesToScan = staged
            .filter(f => SCANNED_EXTENSIONS.has(path.extname(f)))
            .map(f => path.join(root, f));
    }

    filesToScan = filesToScan.filter(f => !isAllowlisted(f.replace(/\\/g, '/')));

    if (filesToScan.length === 0) {
        console.log('[check-secrets] No files to scan. Passed.');
        return;
    }

    const allFindings = (await Promise.all(filesToScan.map(scanFile))).flat();

    if (allFindings.length === 0) {
        console.log(`[check-secrets] Scanned ${filesToScan.length} file(s). No secrets found. ✓`);
        return;
    }

    console.error('[check-secrets] ❌ Secret leak detected:\n');
    for (const { file, line, description, snippet } of allFindings) {
        const rel = path.relative(root, file).replace(/\\/g, '/');
        console.error(`  ${rel}:${line} — ${description}`);
        console.error(`    > ${snippet}`);
    }
    console.error('\nFix the above before committing.');
    process.exit(1);
}

main().catch(err => {
    console.error('[check-secrets] Script error:', err);
    process.exit(1);
});

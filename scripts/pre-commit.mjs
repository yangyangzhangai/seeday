/**
 * pre-commit.mjs
 * Git pre-commit hook 入口，按顺序执行所有代码质量检查。
 * 任意一项失败 → 退出码 1 → git 拒绝提交。
 *
 * 执行顺序（快速失败优先）:
 *   1. check-secrets     — 密钥泄露（最快，最危险）
 *   2. check-max-lines   — 文件行数（慢但直接）
 *   3. check-doc-sync    — 文档同构（中速）
 *   4. tsc --noEmit      — 类型检查（最慢，放最后）
 *
 * 注意: check-state-consistency 依赖未 staged 的文件变更感知，
 *       在 pre-commit 时机不准确，改为 commit-msg hook 或手动执行。
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function run(label, command) {
    process.stdout.write(`\n[pre-commit] ${label}... `);
    try {
        execSync(command, { cwd: root, stdio: 'inherit' });
        console.log('✓');
        return true;
    } catch {
        // error output already printed by inherit stdio
        return false;
    }
}

async function main() {
    console.log('[pre-commit] Running checks before commit...');

    const checks = [
        ['Secrets scan', 'node ./scripts/check-secrets.mjs'],
        ['Max lines', 'node ./scripts/check-max-lines.mjs'],
        ['Doc sync', 'node ./scripts/check-doc-sync.mjs'],
        ['TypeScript', 'npx tsc --noEmit'],
    ];

    for (const [label, command] of checks) {
        const ok = run(label, command);
        if (!ok) {
            console.error(`\n[pre-commit] ❌ Check failed: ${label}`);
            console.error('[pre-commit] Fix the issues above, then try committing again.\n');
            process.exit(1);
        }
    }

    console.log('\n[pre-commit] ✅ All checks passed. Proceeding with commit.\n');
}

main().catch(err => {
    console.error('[pre-commit] Script error:', err);
    process.exit(1);
});

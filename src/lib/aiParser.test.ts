// DOC-DEPS: LLM.md -> api/README.md
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

describe('annotation parser in native Node ESM', () => {
  it('handles invalid and malformed model output without Vite globals', () => {
    const source = readFileSync(new URL('./aiParser.ts', import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    });
    const script = `${outputText}
      import assert from 'node:assert/strict';
      assert.equal(import.meta.env, undefined);
      assert.equal(extractComment(''), null);
      assert.equal(extractComment('invalid'), null);
      assert.equal(extractComment('{"comment":"bad",}'), null);
      const valid = 'You made space for a quiet moment today.';
      assert.equal(extractComment(valid, 'en'), valid);
      assert.equal(extractComment(JSON.stringify({comment: valid}), 'en'), valid);
      assert.equal(extractComment('{"comment":"bad",}\\n' + valid, 'en'),
        valid);
    `;
    expect(() => execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      stdio: 'pipe',
    })).not.toThrow();
  });
});

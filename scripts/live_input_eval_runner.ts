import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyLiveInput } from '../src/services/input/liveInputClassifier';
import type { LiveInputContext, LiveInputInternalKind } from '../src/services/input/types';

type RawSample = {
  id?: string | number;
  input?: string;
  lang?: string;
  last_activity_context?: string | null;
  expected_kind?: 'activity' | 'mood';
  expected_internal_kind?: LiveInputInternalKind | string;
  difficulty?: string | null;
};

type MismatchRow = {
  id: string | number | undefined;
  input: string;
  ctx: string | null;
  expected: string;
  predicted: string;
  difficulty: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const value = (key: string): string | undefined => {
    const idx = args.indexOf(key);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const samplesJson = value('--samples-json');
  const topErrors = Number(value('--top-errors') ?? 15);
  if (!samplesJson) {
    throw new Error('Missing required argument: --samples-json <path>');
  }
  return { samplesJson, topErrors };
}

function toRecentActivity(contextText: string) {
  return {
    id: 'ctx-last-activity',
    content: contextText,
    timestamp: Date.now() - 5 * 60 * 1000,
    isOngoing: false,
  };
}

function main() {
  const { samplesJson, topErrors } = parseArgs();
  const raw = readFileSync(resolve(samplesJson), 'utf-8');
  const samples = JSON.parse(raw) as RawSample[];

  if (samples.length === 0) {
    console.log('No samples found for the selected filter.');
    return;
  }

  let correctKind = 0;
  let correctInternal = 0;
  const mismatchPairs = new Map<string, number>();
  const errorRows: MismatchRow[] = [];
  const perExpected = new Map<string, { hit: number; total: number }>();
  const perDifficulty = new Map<string, { hit: number; total: number }>();

  for (const sample of samples) {
    const input = String(sample.input ?? '');
    const expectedKind = String(sample.expected_kind ?? 'mood');
    const expectedInternal = String(sample.expected_internal_kind ?? 'standalone_mood');
    const contextText = sample.last_activity_context ? String(sample.last_activity_context) : null;

    const context: LiveInputContext = {
      now: Date.now(),
      recentActivity: contextText ? toRecentActivity(contextText) : undefined,
    };
    const predicted = classifyLiveInput(input, context);
    const predictedKind = predicted.kind;
    const predictedInternal = predicted.internalKind;

    if (predictedKind === expectedKind) {
      correctKind += 1;
    }
    if (predictedInternal === expectedInternal) {
      correctInternal += 1;
    }

    const expectedStats = perExpected.get(expectedInternal) ?? { hit: 0, total: 0 };
    expectedStats.total += 1;
    expectedStats.hit += Number(predictedInternal === expectedInternal);
    perExpected.set(expectedInternal, expectedStats);

    const difficulty = String(sample.difficulty ?? 'unknown');
    const difficultyStats = perDifficulty.get(difficulty) ?? { hit: 0, total: 0 };
    difficultyStats.total += 1;
    difficultyStats.hit += Number(predictedInternal === expectedInternal);
    perDifficulty.set(difficulty, difficultyStats);

    if (predictedInternal !== expectedInternal) {
      const pairKey = `${expectedInternal} -> ${predictedInternal}`;
      mismatchPairs.set(pairKey, (mismatchPairs.get(pairKey) ?? 0) + 1);
      errorRows.push({
        id: sample.id,
        input,
        ctx: contextText,
        expected: expectedInternal,
        predicted: predictedInternal,
        difficulty,
      });
    }
  }

  const total = samples.length;
  console.log(`samples=${total}`);
  console.log(`kind_accuracy=${correctKind}/${total}=${((correctKind / total) * 100).toFixed(2)}%`);
  console.log(`internal_accuracy=${correctInternal}/${total}=${((correctInternal / total) * 100).toFixed(2)}%`);
  console.log('');
  console.log('top_mismatch_pairs:');
  Array.from(mismatchPairs.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([pair, count]) => {
      console.log(`  ${pair}: ${count}`);
    });

  console.log('');
  console.log('recall_by_expected_internal:');
  Array.from(perExpected.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([key, stats]) => {
      console.log(`  ${key}: ${stats.hit}/${stats.total}=${((stats.hit / stats.total) * 100).toFixed(2)}%`);
    });

  console.log('');
  console.log('accuracy_by_difficulty:');
  Array.from(perDifficulty.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([key, stats]) => {
      console.log(`  ${key}: ${stats.hit}/${stats.total}=${((stats.hit / stats.total) * 100).toFixed(2)}%`);
    });

  if (errorRows.length > 0) {
    console.log('');
    console.log(`first_${topErrors}_errors:`);
    errorRows.slice(0, topErrors).forEach((row) => {
      console.log(
        `  id=${row.id} input=${row.input} ctx=${row.ctx} expected=${row.expected} predicted=${row.predicted} difficulty=${row.difficulty}`,
      );
    });
  }
}

main();

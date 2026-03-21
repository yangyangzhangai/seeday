// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/ACTIVITY_MOOD_AUTO_RECOGNITION.md -> docs/LEXICON_ARCHITECTURE.md
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { classifyLiveInput } from '../src/services/input/liveInputClassifier';
import { parseMagicPenInputLocal } from '../src/services/input/magicPenParserLocalFallback';
import { classifyRecordActivityType, normalizeTodoCategory, type ActivityRecordType } from '../src/lib/activityType';
import type { LiveInputContext, InternalLiveInputKind } from '../src/services/input/types';
import type { SupportedLang } from '../src/services/input/lexicon/getLexicon';

type LiveFixture = {
  id: string;
  lang: SupportedLang;
  input: string;
  contextRecentActivity?: string;
  expectedKind: 'activity' | 'mood';
  expectedInternalKind: InternalLiveInputKind;
  subset?: 'core' | 'future_plan' | 'negation' | 'mood_about_last_activity';
};

type CategoryFixture = {
  id: string;
  lang: SupportedLang;
  content: string;
  expected: ActivityRecordType;
};

type TodoFixture = {
  id: string;
  lang: SupportedLang;
  title: string;
  expected: ActivityRecordType;
};

type MagicPenFixture = {
  id: string;
  lang: SupportedLang;
  input: string;
  expected: 'activity_backfill' | 'todo_add' | 'unparsed';
  note?: string;
};

type Counter = { hit: number; total: number };

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(resolve(filePath), 'utf-8')) as T;
}

function pct(counter: Counter): string {
  if (counter.total === 0) return 'n/a';
  return `${((counter.hit / counter.total) * 100).toFixed(2)}% (${counter.hit}/${counter.total})`;
}

function addHit(bucket: Map<string, Counter>, key: string, matched: boolean): void {
  const stats = bucket.get(key) ?? { hit: 0, total: 0 };
  stats.total += 1;
  stats.hit += Number(matched);
  bucket.set(key, stats);
}

function evaluateLiveIntent(fixtures: LiveFixture[]) {
  let kindHit = 0;
  let internalHit = 0;
  const byLang = new Map<string, Counter>();
  const bySubset = new Map<string, Counter>();
  const mismatches: Array<{ id: string; expected: string; predicted: string }> = [];

  for (const fixture of fixtures) {
    const context: LiveInputContext = {
      now: Date.now(),
      recentActivity: fixture.contextRecentActivity
        ? {
          id: `ctx-${fixture.id}`,
          content: fixture.contextRecentActivity,
          timestamp: Date.now() - 5 * 60 * 1000,
          isOngoing: false,
        }
        : undefined,
    };

    const predicted = classifyLiveInput(fixture.input, context);
    const kindMatched = predicted.kind === fixture.expectedKind;
    const internalMatched = predicted.internalKind === fixture.expectedInternalKind;

    kindHit += Number(kindMatched);
    internalHit += Number(internalMatched);
    addHit(byLang, fixture.lang, internalMatched);
    addHit(bySubset, fixture.subset ?? 'core', internalMatched);

    if (!internalMatched) {
      mismatches.push({
        id: fixture.id,
        expected: fixture.expectedInternalKind,
        predicted: predicted.internalKind,
      });
    }
  }

  return {
    total: fixtures.length,
    kind: { hit: kindHit, total: fixtures.length },
    internal: { hit: internalHit, total: fixtures.length },
    byLang,
    bySubset,
    mismatches,
  };
}

function evaluateActivityCategory(fixtures: CategoryFixture[]) {
  const byLang = new Map<string, Counter>();
  const mismatches: Array<{ id: string; expected: string; predicted: string }> = [];
  let hit = 0;

  for (const fixture of fixtures) {
    const predicted = classifyRecordActivityType(fixture.content, fixture.lang).activityType;
    const matched = predicted === fixture.expected;
    hit += Number(matched);
    addHit(byLang, fixture.lang, matched);
    if (!matched) mismatches.push({ id: fixture.id, expected: fixture.expected, predicted });
  }

  return {
    total: fixtures.length,
    overall: { hit, total: fixtures.length },
    byLang,
    mismatches,
  };
}

function evaluateTodoCategory(fixtures: TodoFixture[]) {
  const byLang = new Map<string, Counter>();
  const mismatches: Array<{ id: string; expected: string; predicted: string }> = [];
  let hit = 0;

  for (const fixture of fixtures) {
    const predicted = normalizeTodoCategory(undefined, fixture.title, fixture.lang);
    const matched = predicted === fixture.expected;
    hit += Number(matched);
    addHit(byLang, fixture.lang, matched);
    if (!matched) mismatches.push({ id: fixture.id, expected: fixture.expected, predicted });
  }

  return {
    total: fixtures.length,
    overall: { hit, total: fixtures.length },
    byLang,
    mismatches,
  };
}

function evaluateMagicPenFallback(fixtures: MagicPenFixture[]) {
  const byLang = new Map<string, Counter>();
  const mismatches: Array<{ id: string; expected: string; predicted: string }> = [];
  const now = new Date(2026, 2, 21, 10, 0, 0, 0);
  let hit = 0;

  for (const fixture of fixtures) {
    const parsed = parseMagicPenInputLocal(fixture.input, now, fixture.lang);
    const predicted = parsed.drafts.length === 0 ? 'unparsed' : parsed.drafts[0].kind;
    const matched = predicted === fixture.expected;
    hit += Number(matched);
    addHit(byLang, fixture.lang, matched);
    if (!matched) mismatches.push({ id: fixture.id, expected: fixture.expected, predicted });
  }

  return {
    total: fixtures.length,
    overall: { hit, total: fixtures.length },
    byLang,
    mismatches,
  };
}

function parseArtifactArg(): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--artifact-out');
  return idx >= 0 ? args[idx + 1] : undefined;
}

function printCounterMap(title: string, bucket: Map<string, Counter>): void {
  console.log(title);
  for (const [key, value] of bucket.entries()) {
    console.log(`  ${key}: ${pct(value)}`);
  }
}

function main() {
  const liveFixtures = loadJson<LiveFixture[]>('src/services/input/__fixtures__/liveInput.intent.fixture.json');
  const activityFixtures = loadJson<CategoryFixture[]>('src/services/input/__fixtures__/activity.category.fixture.json');
  const todoFixtures = loadJson<TodoFixture[]>('src/services/input/__fixtures__/todo.category.fixture.json');
  const magicFixtures = loadJson<MagicPenFixture[]>('src/services/input/__fixtures__/magicPen.fallback.fixture.json');

  const live = evaluateLiveIntent(liveFixtures);
  const activity = evaluateActivityCategory(activityFixtures);
  const todo = evaluateTodoCategory(todoFixtures);
  const magic = evaluateMagicPenFallback(magicFixtures);

  console.log('=== PR0 Multilingual Classification Baseline ===');
  console.log(`generated_at=${new Date().toISOString()}`);
  console.log('');

  console.log('[live-input intent]');
  console.log(`  kind_accuracy: ${pct(live.kind)}`);
  console.log(`  internal_accuracy: ${pct(live.internal)}`);
  printCounterMap('  by_lang:', live.byLang);
  printCounterMap('  high_risk_subsets:', live.bySubset);
  console.log(`  mismatches: ${live.mismatches.length}`);
  console.log('');

  console.log('[activity category]');
  console.log(`  accuracy: ${pct(activity.overall)}`);
  printCounterMap('  by_lang:', activity.byLang);
  console.log(`  mismatches: ${activity.mismatches.length}`);
  console.log('');

  console.log('[todo category]');
  console.log(`  accuracy: ${pct(todo.overall)}`);
  printCounterMap('  by_lang:', todo.byLang);
  console.log(`  mismatches: ${todo.mismatches.length}`);
  console.log('');

  console.log('[magic-pen local fallback]');
  console.log(`  accuracy: ${pct(magic.overall)}`);
  printCounterMap('  by_lang:', magic.byLang);
  console.log(`  mismatches: ${magic.mismatches.length}`);

  const artifactPath = parseArtifactArg();
  if (artifactPath) {
    const artifact = {
      generatedAt: new Date().toISOString(),
      liveInput: {
        kind: live.kind,
        internal: live.internal,
        byLang: Object.fromEntries(live.byLang.entries()),
        bySubset: Object.fromEntries(live.bySubset.entries()),
        mismatches: live.mismatches,
      },
      activityCategory: {
        overall: activity.overall,
        byLang: Object.fromEntries(activity.byLang.entries()),
        mismatches: activity.mismatches,
      },
      todoCategory: {
        overall: todo.overall,
        byLang: Object.fromEntries(todo.byLang.entries()),
        mismatches: todo.mismatches,
      },
      magicPenFallback: {
        overall: magic.overall,
        byLang: Object.fromEntries(magic.byLang.entries()),
        mismatches: magic.mismatches,
      },
    };
    const out = resolve(artifactPath);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(artifact, null, 2), 'utf-8');
    console.log('');
    console.log(`artifact_written=${out}`);
  }
}

main();

// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callShortInsightAPI } from '../api/client';
import {
  buildDiaryPageSnapshot,
  upgradeDiaryPageSnapshot,
  type DiarySnapshotStats,
} from './reportDiarySnapshot';

vi.mock('../api/client', () => ({
  callShortInsightAPI: vi.fn(),
}));

function reportStats(): DiarySnapshotStats {
  return {
    completedTodos: 2,
    totalTodos: 3,
    completionRate: 2 / 3,
    actionAnalysis: [{ category: 'work', minutes: 90, percent: 1 }],
    actionSummary: '固定的活动分析',
    moodDistribution: [{ mood: 'calm', minutes: 45 }],
    moodSummary: '固定的情绪分析',
    habitCheckin: [{ done: true }, { done: false }],
    goalProgress: [{ doneToday: true }],
  };
}

describe('diary page snapshot', () => {
  beforeEach(() => {
    vi.mocked(callShortInsightAPI).mockReset();
  });

  it('captures all first-page data in one immutable value', () => {
    const stats = reportStats();
    const snapshot = buildDiaryPageSnapshot(stats, 'zh', 123);

    stats.completedTodos = 0;
    stats.actionAnalysis![0].minutes = 10;
    stats.moodDistribution![0].minutes = 5;

    expect(snapshot.generatedAt).toBe(123);
    expect(snapshot.todoCompleted).toBe(2);
    expect(snapshot.actionAnalysis[0].minutes).toBe(90);
    expect(snapshot.moodDistribution[0].minutes).toBe(45);
    expect(snapshot.starsToday).toBe(2);
    expect(snapshot.version).toBe(2);
    expect(snapshot.activitySummary).toBe('固定的活动分析');
    expect(snapshot.moodSummary).toBe('固定的情绪分析');
  });

  it('builds a deterministic legacy snapshot from stored report stats', () => {
    const stats = reportStats();

    expect(buildDiaryPageSnapshot(stats, 'zh', 1))
      .toEqual(buildDiaryPageSnapshot(stats, 'zh', 1));
  });

  it('upgrades legacy clipped summaries from frozen snapshot counts', async () => {
    vi.mocked(callShortInsightAPI).mockImplementation(async ({ kind }) => (
      kind === 'todo'
        ? 'You kept a thoughtful pace through today'
        : 'Steady habits made room for gentle progress'
    ));
    const legacy = {
      ...buildDiaryPageSnapshot(reportStats(), 'en', 123),
      version: 1 as const,
      todoSummary: "You're in the slow I",
      habitSummary: 'Steady habits made ro',
    };

    const upgraded = await upgradeDiaryPageSnapshot(legacy);

    expect(upgraded.version).toBe(2);
    expect(upgraded.generatedAt).toBe(123);
    expect(upgraded.todoCompleted).toBe(2);
    expect(upgraded.todoSummary).toBe('You kept a thoughtful pace through today.');
    expect(upgraded.habitSummary).toBe('Steady habits made room for gentle progress.');
    expect(callShortInsightAPI).toHaveBeenCalledTimes(2);
  });

  it('does not regenerate a current snapshot', async () => {
    const current = buildDiaryPageSnapshot(reportStats(), 'en', 123);

    expect(await upgradeDiaryPageSnapshot(current)).toBe(current);
    expect(callShortInsightAPI).not.toHaveBeenCalled();
  });
});

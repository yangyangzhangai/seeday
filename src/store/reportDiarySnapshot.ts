// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md -> src/store/README.md
import { callShortInsightAPI } from '../api/client';
import { compactDiaryInsight, isLegacyTruncatedDiaryInsight } from '../lib/diaryInsightText';
import { generateActionSummary, generateMoodSummary } from './reportHelpers';

export type DiarySnapshotLang = 'zh' | 'en' | 'it';

type ActionAnalysisItem = {
  category: 'study' | 'work' | 'social' | 'life' | 'entertainment' | 'health';
  minutes: number;
  percent: number;
};

type MoodDistributionItem = {
  mood: string;
  minutes: number;
};

export interface DiaryPageSnapshot {
  version: 1 | 2;
  generatedAt: number;
  lang: DiarySnapshotLang;
  actionAnalysis: ActionAnalysisItem[];
  moodDistribution: MoodDistributionItem[];
  activitySummary: string;
  moodSummary: string;
  todoCompleted: number;
  todoTotal: number;
  todoCompletionRate: number;
  todoSummary: string;
  habitDone: number;
  habitTotal: number;
  goalDone: number;
  goalTotal: number;
  starsToday: number;
  habitSummary: string;
}

export interface DiarySnapshotStats {
  completedTodos: number;
  totalTodos: number;
  completionRate: number;
  actionAnalysis?: ActionAnalysisItem[];
  actionSummary?: string;
  moodSummary?: string;
  moodDistribution?: MoodDistributionItem[];
  habitCheckin?: Array<{ done: boolean }>;
  goalProgress?: Array<{ doneToday: boolean }>;
}

const FALLBACK_COPY: Record<DiarySnapshotLang, {
  activity: string;
  mood: string;
  todo: string;
  habit: string;
}> = {
  zh: {
    activity: '今天主要精力投入在工作上',
    mood: '整体情绪比较轻松愉快',
    todo: '你今天做得很好',
    habit: '继续保持，进度很稳',
  },
  en: {
    activity: 'Mostly working today',
    mood: 'Feeling joyful most of the day',
    todo: 'You did great today',
    habit: 'Nice rhythm, keep going',
  },
  it: {
    activity: 'Oggi soprattutto lavoro',
    mood: 'Umore positivo per gran parte della giornata',
    todo: 'Hai fatto un ottimo lavoro oggi',
    habit: 'Continua cosi, ottimo passo',
  },
};

function buildTodoPrompt(stats: DiarySnapshotStats, lang: DiarySnapshotLang): string {
  const completed = stats.completedTodos;
  const total = stats.totalTodos;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  if (lang === 'zh') return `待办完成${completed}/${total}，完成率${rate}%`;
  if (lang === 'it') return `Todo completati ${completed}/${total}, tasso ${rate}%`;
  return `Completed todos ${completed}/${total}, completion rate ${rate}%`;
}

function buildHabitPrompt(snapshot: DiaryPageSnapshot): string {
  if (snapshot.lang === 'zh') {
    return `习惯${snapshot.habitDone}/${snapshot.habitTotal}，目标${snapshot.goalDone}/${snapshot.goalTotal}，星星${snapshot.starsToday}`;
  }
  if (snapshot.lang === 'it') {
    return `Abitudini ${snapshot.habitDone}/${snapshot.habitTotal}, obiettivi ${snapshot.goalDone}/${snapshot.goalTotal}, stelle ${snapshot.starsToday}`;
  }
  return `Habits ${snapshot.habitDone}/${snapshot.habitTotal}, goals ${snapshot.goalDone}/${snapshot.goalTotal}, stars ${snapshot.starsToday}`;
}

export function buildDiaryPageSnapshot(
  stats: DiarySnapshotStats,
  lang: DiarySnapshotLang,
  generatedAt = Date.now(),
): DiaryPageSnapshot {
  const actionAnalysis = (stats.actionAnalysis ?? []).map(item => ({ ...item }));
  const moodDistribution = (stats.moodDistribution ?? []).map(item => ({ ...item }));
  const habitDone = stats.habitCheckin?.filter(item => item.done).length ?? 0;
  const habitTotal = stats.habitCheckin?.length ?? 0;
  const goalDone = stats.goalProgress?.filter(item => item.doneToday).length ?? 0;
  const goalTotal = stats.goalProgress?.length ?? 0;
  return {
    version: 2,
    generatedAt,
    lang,
    actionAnalysis,
    moodDistribution,
    activitySummary: stats.actionSummary?.trim()
      || (actionAnalysis.length > 0 ? generateActionSummary(actionAnalysis, lang) : FALLBACK_COPY[lang].activity),
    moodSummary: stats.moodSummary?.trim()
      || (moodDistribution.length > 0 ? generateMoodSummary(moodDistribution, lang) : FALLBACK_COPY[lang].mood),
    todoCompleted: stats.completedTodos,
    todoTotal: stats.totalTodos,
    todoCompletionRate: stats.completionRate,
    todoSummary: FALLBACK_COPY[lang].todo,
    habitDone,
    habitTotal,
    goalDone,
    goalTotal,
    starsToday: habitDone + goalDone,
    habitSummary: FALLBACK_COPY[lang].habit,
  };
}

export async function generateDiaryPageSnapshot(
  stats: DiarySnapshotStats,
  lang: DiarySnapshotLang,
): Promise<DiaryPageSnapshot> {
  const snapshot = buildDiaryPageSnapshot(stats, lang);
  const todoRequest = snapshot.todoTotal > 0
    ? callShortInsightAPI({ kind: 'todo', summary: buildTodoPrompt(stats, lang), lang })
    : Promise.resolve('');
  const habitRequest = snapshot.habitTotal + snapshot.goalTotal > 0
    ? callShortInsightAPI({ kind: 'habit', summary: buildHabitPrompt(snapshot), lang })
    : Promise.resolve('');
  const [todoInsight, habitInsight] = await Promise.all([todoRequest, habitRequest]);
  return {
    ...snapshot,
    todoSummary: compactDiaryInsight(todoInsight, lang) || snapshot.todoSummary,
    habitSummary: compactDiaryInsight(habitInsight, lang) || snapshot.habitSummary,
  };
}

function keepOrReplaceLegacyInsight(
  insight: string,
  replacement: string,
  fallback: string,
  lang: DiarySnapshotLang,
): string {
  if (replacement) return compactDiaryInsight(replacement, lang);
  if (isLegacyTruncatedDiaryInsight(insight)) return fallback;
  return compactDiaryInsight(insight, lang) || fallback;
}

export async function upgradeDiaryPageSnapshot(
  snapshot: DiaryPageSnapshot,
): Promise<DiaryPageSnapshot> {
  if (snapshot.version === 2) return snapshot;
  const todoRequest = snapshot.todoTotal > 0
    ? callShortInsightAPI({
      kind: 'todo',
      summary: buildTodoPrompt({
        completedTodos: snapshot.todoCompleted,
        totalTodos: snapshot.todoTotal,
        completionRate: snapshot.todoCompletionRate,
      }, snapshot.lang),
      lang: snapshot.lang,
    })
    : Promise.resolve('');
  const habitRequest = snapshot.habitTotal + snapshot.goalTotal > 0
    ? callShortInsightAPI({ kind: 'habit', summary: buildHabitPrompt(snapshot), lang: snapshot.lang })
    : Promise.resolve('');
  const [todoInsight, habitInsight] = await Promise.all([todoRequest, habitRequest]);
  return {
    ...snapshot,
    version: 2,
    todoSummary: keepOrReplaceLegacyInsight(
      snapshot.todoSummary,
      todoInsight,
      FALLBACK_COPY[snapshot.lang].todo,
      snapshot.lang,
    ),
    habitSummary: keepOrReplaceLegacyInsight(
      snapshot.habitSummary,
      habitInsight,
      FALLBACK_COPY[snapshot.lang].habit,
      snapshot.lang,
    ),
  };
}

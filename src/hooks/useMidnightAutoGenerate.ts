// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/useReportStore.ts -> src/store/usePlantStore.ts
import { useEffect, useRef } from 'react';
import { isSameDay, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useTodoStore } from '../store/useTodoStore';
import { useMoodStore } from '../store/useMoodStore';
import { useGrowthStore } from '../store/useGrowthStore';
import { callPlantGenerateAPI } from '../api/client';

const RETRY_COOLDOWN_MS = 60 * 1000;
const WARMUP_TIMEOUT_MS = 6000;
const POLL_INTERVAL_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDomainWarmup(timeoutMs = WARMUP_TIMEOUT_MS): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const chat = useChatStore.getState();
    const todo = useTodoStore.getState();
    const growth = useGrowthStore.getState();
    const mood = useMoodStore.getState();
    const chatReady = chat.hasInitialized && !chat.isLoading;
    const todoReady = todo.hasHydrated && !todo.isLoading;
    const growthReady = growth.hasHydrated && !growth.isLoading;
    const moodReady = !!mood.lastFetchedAt;
    if (chatReady && todoReady && growthReady && moodReady) return;
    await sleep(POLL_INTERVAL_MS);
  }
}

async function warmupRequiredDomains(): Promise<void> {
  const chat = useChatStore.getState();
  const todo = useTodoStore.getState();
  const growth = useGrowthStore.getState();
  const mood = useMoodStore.getState();
  await Promise.all([
    (!chat.hasInitialized && !chat.isLoading) ? chat.fetchMessages() : Promise.resolve(),
    (!todo.hasHydrated && !todo.isLoading) ? todo.fetchTodos() : Promise.resolve(),
    (!growth.hasHydrated && !growth.isLoading) ? growth.fetchBottles() : Promise.resolve(),
    !mood.lastFetchedAt ? mood.fetchMoods() : Promise.resolve(),
  ]);
  await waitForDomainWarmup();
}

function isReportStatsSparse(reportId: string): boolean {
  const report = useReportStore.getState().reports.find((item) => item.id === reportId);
  const stats = report?.stats;
  if (!stats) return true;
  const hasAction = (stats.actionAnalysis?.length || 0) > 0;
  const hasMood = (stats.moodDistribution?.length || 0) > 0;
  const hasTodo = (stats.totalTodos || 0) > 0;
  return !hasAction && !hasMood && !hasTodo;
}

async function repairSparseDailyReportIfNeeded(reportId: string, date: Date): Promise<string> {
  const chatStore = useChatStore.getState();
  const reportStore = useReportStore.getState();
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  const messages = await chatStore.getMessagesForDateRange(dayStart, dayEnd);
  if (messages.length === 0) return reportId;
  if (!isReportStatsSparse(reportId)) return reportId;
  return reportStore.generateReport('daily', date.getTime());
}

function resolveLang(rawLang: string): 'zh' | 'en' | 'it' {
  const lang = rawLang.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('it')) return 'it';
  return 'en';
}

async function generatePlantForDate(date: Date, lang: string): Promise<void> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  try {
    await callPlantGenerateAPI({ date: format(date, 'yyyy-MM-dd'), timezone, lang: resolveLang(lang) });
  } catch {
    // best-effort
  }
}

async function generateAIDiaryIfNeeded(reportId: string): Promise<void> {
  const reportStore = useReportStore.getState();
  const report = reportStore.reports.find(r => r.id === reportId);
  if (!report || report.aiAnalysis || report.analysisStatus === 'generating') return;
  try {
    await reportStore.generateAIDiary(reportId);
  } catch {
    // best-effort
  }
}

async function runMidnightGenerate(isPlus: boolean, lang: string): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  await warmupRequiredDomains();

  const reportStore = useReportStore.getState();
  const existing = reportStore.reports.find(
    r => r.type === 'daily' && isSameDay(new Date(r.date), yesterday),
  );
  const initialReportId = existing?.id ?? await reportStore.generateReport('daily', yesterday.getTime());
  const reportId = await repairSparseDailyReportIfNeeded(initialReportId, yesterday);

  await generatePlantForDate(yesterday, lang);

  if (isPlus) {
    await generateAIDiaryIfNeeded(reportId);
  }
}

function shouldSkipDueToCooldown(lastAttemptAtMs: number): boolean {
  return Date.now() - lastAttemptAtMs < RETRY_COOLDOWN_MS;
}

export function useMidnightAutoGenerate() {
  const userId = useAuthStore(state => state.user?.id);
  const isPlus = useAuthStore(state => state.isPlus);
  const { i18n } = useTranslation();
  const isPlusRef = useRef(isPlus);
  isPlusRef.current = isPlus;
  const langRef = useRef(i18n.language);
  langRef.current = i18n.language;
  const runningRef = useRef(false);
  const lastAttemptAtMsRef = useRef(0);

  const runOnce = async (force = false) => {
    if (!userId) return;
    if (runningRef.current) return;
    if (!force && shouldSkipDueToCooldown(lastAttemptAtMsRef.current)) return;
    runningRef.current = true;
    lastAttemptAtMsRef.current = Date.now();
    try {
      await runMidnightGenerate(isPlusRef.current, langRef.current ?? 'en');
    } finally {
      runningRef.current = false;
    }
  };

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      timer = setTimeout(async () => {
        await runOnce(true);
        schedule();
      }, midnight.getTime() - now.getTime());
    };

    void runOnce(true);

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void runOnce(false);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    schedule();
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId]);
}

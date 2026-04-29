// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/useReportStore.ts -> src/store/usePlantStore.ts
import { useEffect, useRef } from 'react';
import { isSameDay, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { callPlantGenerateAPI } from '../api/client';

const RETRY_COOLDOWN_MS = 60 * 1000;

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

  const reportStore = useReportStore.getState();
  const existing = reportStore.reports.find(
    r => r.type === 'daily' && isSameDay(new Date(r.date), yesterday),
  );
  const reportId = existing?.id ?? await reportStore.generateReport('daily', yesterday.getTime());

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

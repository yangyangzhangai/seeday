// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/useReportStore.ts -> src/store/usePlantStore.ts
import { useEffect, useRef } from 'react';
import { isSameDay, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { callPlantGenerateAPI } from '../api/client';

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

export function useMidnightAutoGenerate() {
  const userId = useAuthStore(state => state.user?.id);
  const isPlus = useAuthStore(state => state.isPlus);
  const { i18n } = useTranslation();
  const isPlusRef = useRef(isPlus);
  isPlusRef.current = isPlus;
  const langRef = useRef(i18n.language);
  langRef.current = i18n.language;

  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      timer = setTimeout(async () => {
        await runMidnightGenerate(isPlusRef.current, langRef.current ?? 'en');
        schedule();
      }, midnight.getTime() - now.getTime());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [userId]);
}

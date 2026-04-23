// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/usePlantStore.ts -> src/store/useReportStore.ts
import { useState, useEffect, useRef } from 'react';
import { isSameDay } from 'date-fns';
import { usePlantStore } from '../store/usePlantStore';
import { useReportStore } from '../store/useReportStore';
import { useAuthStore } from '../store/useAuthStore';
import { getScopedClientStorageKey, resolveStorageScopeForUser } from '../store/storageScope';
import type { DailyPlantRecord } from '../types/plant';
import type { Report } from '../store/useReportStore';

const DISMISSED_KEY = 'night_reminder_dismissed_date';

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isAlreadyDismissedToday(storageKey: string): boolean {
  return localStorage.getItem(storageKey) === getTodayStr();
}

function isPlantGeneratedToday(todayPlant: DailyPlantRecord | null): boolean {
  if (!todayPlant) return false;
  const now = new Date();
  const [y, m, d] = todayPlant.date.split('-').map(Number);
  return y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
}

function isDiaryGeneratedToday(reports: Report[]): boolean {
  const now = new Date();
  return reports.some(
    r => r.type === 'daily' && isSameDay(new Date(r.date), now) && !!r.aiAnalysis,
  );
}

export function useNightReminder() {
  const [showReminder, setShowReminder] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);
  const todayPlant = usePlantStore(state => state.todayPlant);
  const reports = useReportStore(state => state.reports);
  const dismissedStorageKey = getScopedClientStorageKey(DISMISSED_KEY, resolveStorageScopeForUser(userId ?? null));

  const todayPlantRef = useRef(todayPlant);
  todayPlantRef.current = todayPlant;
  const reportsRef = useRef(reports);
  reportsRef.current = reports;

  useEffect(() => {
    const check = () => {
      if (isAlreadyDismissedToday(dismissedStorageKey)) return;
      const plantDone = isPlantGeneratedToday(todayPlantRef.current);
      const diaryDone = isDiaryGeneratedToday(reportsRef.current);
      if (!plantDone && !diaryDone) {
        setShowReminder(true);
      }
    };

    const now = new Date();
    const todayAt22 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0);

    let timer: ReturnType<typeof setTimeout>;
    if (now >= todayAt22) {
      check();
    } else {
      timer = setTimeout(check, todayAt22.getTime() - now.getTime());
    }

    return () => clearTimeout(timer);
  }, [dismissedStorageKey]);

  const dismiss = () => {
    localStorage.setItem(dismissedStorageKey, getTodayStr());
    setShowReminder(false);
  };

  return { showReminder, dismiss };
}

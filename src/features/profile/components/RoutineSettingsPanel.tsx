// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Clock3 } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  buildRoutineManualPayload,
  DEFAULT_BREAKFAST,
  DEFAULT_DINNER,
  DEFAULT_LUNCH,
  DEFAULT_SLEEP_TIME,
  DEFAULT_WAKE_TIME,
  toHour,
  toHourText,
} from './userProfilePanelHelpers';

interface Props {
  plain?: boolean;
}

interface RoutineSnapshot {
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
}

const ROUTINE_STORAGE_PREFIX = 'profile:routine:v1:';
const TIME_TEXT_PATTERN = /^\d{2}:\d{2}$/;

function getRoutineStorageKey(userId: string | null | undefined): string {
  return `${ROUTINE_STORAGE_PREFIX}${userId || 'guest'}`;
}

function readRoutineSnapshot(storageKey: string): RoutineSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoutineSnapshot>;
    const wakeTime = typeof parsed.wakeTime === 'string' && TIME_TEXT_PATTERN.test(parsed.wakeTime) ? parsed.wakeTime : '';
    const sleepTime = typeof parsed.sleepTime === 'string' && TIME_TEXT_PATTERN.test(parsed.sleepTime) ? parsed.sleepTime : '';
    const breakfastTime = typeof parsed.breakfastTime === 'string' && TIME_TEXT_PATTERN.test(parsed.breakfastTime) ? parsed.breakfastTime : '';
    const lunchTime = typeof parsed.lunchTime === 'string' && TIME_TEXT_PATTERN.test(parsed.lunchTime) ? parsed.lunchTime : '';
    const dinnerTime = typeof parsed.dinnerTime === 'string' && TIME_TEXT_PATTERN.test(parsed.dinnerTime) ? parsed.dinnerTime : '';
    if (!wakeTime || !sleepTime || !breakfastTime || !lunchTime || !dinnerTime) return null;
    return { wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime };
  } catch {
    return null;
  }
}

function writeRoutineSnapshot(storageKey: string, snapshot: RoutineSnapshot): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}

function signature(input: {
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
}): string {
  return JSON.stringify(input);
}

export const RoutineSettingsPanel: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const { userProfileV2, updateUserProfile, user } = useAuthStore();
  const [expanded, setExpanded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveText, setSaveText] = React.useState('');
  const autoSaveTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const autoSaveReadyRef = React.useRef(false);

  const [wakeTime, setWakeTime] = React.useState(DEFAULT_WAKE_TIME);
  const [sleepTime, setSleepTime] = React.useState(DEFAULT_SLEEP_TIME);
  const [breakfastTime, setBreakfastTime] = React.useState(DEFAULT_BREAKFAST);
  const [lunchTime, setLunchTime] = React.useState(DEFAULT_LUNCH);
  const [dinnerTime, setDinnerTime] = React.useState(DEFAULT_DINNER);

  const storageKey = React.useMemo(() => getRoutineStorageKey(user?.id), [user?.id]);

  const cloudRoutineSnapshot = React.useMemo<RoutineSnapshot>(() => {
    const manual = userProfileV2?.manual;
    const mealTimesText = Array.isArray(manual?.mealTimesText) ? manual.mealTimesText : [];
    const mealTimes = Array.isArray(manual?.mealTimes) ? manual.mealTimes : [];
    return {
      wakeTime: manual?.wakeTime || DEFAULT_WAKE_TIME,
      sleepTime: manual?.sleepTime || DEFAULT_SLEEP_TIME,
      breakfastTime: mealTimesText[0] || toHourText(mealTimes[0], DEFAULT_BREAKFAST),
      lunchTime: mealTimesText[1] || toHourText(mealTimes[1], DEFAULT_LUNCH),
      dinnerTime: mealTimesText[2] || toHourText(mealTimes[2], DEFAULT_DINNER),
    };
  }, [userProfileV2]);

  const localRoutineSnapshot = React.useMemo(
    () => readRoutineSnapshot(storageKey),
    [storageKey, userProfileV2?.manual?.updatedAt],
  );

  const resolvedRoutineSnapshot = localRoutineSnapshot || cloudRoutineSnapshot;

  const baselineSignature = React.useMemo(
    () => signature(resolvedRoutineSnapshot),
    [resolvedRoutineSnapshot],
  );

  React.useEffect(() => {
    setWakeTime(resolvedRoutineSnapshot.wakeTime);
    setSleepTime(resolvedRoutineSnapshot.sleepTime);
    setBreakfastTime(resolvedRoutineSnapshot.breakfastTime);
    setLunchTime(resolvedRoutineSnapshot.lunchTime);
    setDinnerTime(resolvedRoutineSnapshot.dinnerTime);
  }, [resolvedRoutineSnapshot]);

  const currentSignature = React.useMemo(
    () => signature({ wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime }),
    [wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime],
  );

  const mealHours = React.useMemo(() => {
    const parsed = [breakfastTime, lunchTime, dinnerTime]
      .map((item) => toHour(item))
      .filter((item): item is number => typeof item === 'number');
    return Array.from(new Set(parsed));
  }, [breakfastTime, lunchTime, dinnerTime]);

  const hasUnsavedChanges = currentSignature !== baselineSignature;
  const timeInputClass =
    'h-8 w-[92px] min-w-[92px] rounded-md border border-[#CBE7D7] bg-white/85 px-2 text-center text-xs text-slate-700 outline-none cursor-pointer';

  const handleTimePickerOpen = (event: React.MouseEvent<HTMLInputElement>) => {
    const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
    input.showPicker?.();
  };

  const performSave = async (mode: 'manual' | 'auto') => {
    if (saving) return;
    if (!hasUnsavedChanges) {
      if (mode === 'manual') {
        setSaveText(t('profile_routine_no_changes'));
      }
      return;
    }

    if (mode === 'manual') {
      setSaveText('');
    }
    setSaving(true);
    const nextManual = buildRoutineManualPayload(userProfileV2?.manual, {
      wakeTime,
      sleepTime,
      mealHours,
      mealTimesText: [breakfastTime, lunchTime, dinnerTime],
    });
    const { error } = await updateUserProfile({ manual: nextManual });
    setSaving(false);
    if (error) {
      setSaveText(t('profile_routine_save_failed'));
      return;
    }
    writeRoutineSnapshot(storageKey, {
      wakeTime,
      sleepTime,
      breakfastTime,
      lunchTime,
      dinnerTime,
    });
    if (mode === 'manual') {
      setSaveText(t('profile_routine_saved'));
    }
  };

  const handleSave = async () => {
    await performSave('manual');
  };

  React.useEffect(() => {
    if (!autoSaveReadyRef.current) {
      if (!hasUnsavedChanges) {
        autoSaveReadyRef.current = true;
      }
      return;
    }
    if (!hasUnsavedChanges || saving) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      void performSave('auto');
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    hasUnsavedChanges,
    saving,
    wakeTime,
    sleepTime,
    breakfastTime,
    lunchTime,
    dinnerTime,
    userProfileV2,
  ]);

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
      >
        <div className="flex items-start gap-2.5 text-left">
          <Clock3 size={16} strokeWidth={1.5} className="mt-0.5 text-[#5F7A63]" />
          <div>
            <p className="profile-fn-title">{t('profile_routine_title')}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} strokeWidth={1.5} className="text-slate-400" /> : <ChevronDown size={16} strokeWidth={1.5} className="text-slate-400" />}
      </button>

      {expanded ? (
        <div className="border-t border-slate-200/60 px-4 pb-4 pt-3">
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-x-2 gap-y-2">
              <label className="flex w-full flex-col items-start">
                <span className="mb-1 block text-left text-xs text-slate-600">{t('profile_user_profile_wake_time')}</span>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(event) => setWakeTime(event.target.value)}
                  onClick={handleTimePickerOpen}
                  onFocus={(event) => event.currentTarget.showPicker?.()}
                  inputMode="none"
                  step={60}
                  className={timeInputClass}
                />
              </label>
              <label className="flex w-full flex-col items-start">
                <span className="mb-1 block text-left text-xs text-slate-600">{t('profile_user_profile_sleep_time')}</span>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(event) => setSleepTime(event.target.value)}
                  onClick={handleTimePickerOpen}
                  onFocus={(event) => event.currentTarget.showPicker?.()}
                  inputMode="none"
                  step={60}
                  className={timeInputClass}
                />
              </label>
              <label className="flex w-full flex-col items-start">
                <span className="mb-1 block text-left text-xs text-slate-600">{t('profile_user_profile_breakfast')}</span>
                <input
                  type="time"
                  value={breakfastTime}
                  onChange={(event) => setBreakfastTime(event.target.value)}
                  onClick={handleTimePickerOpen}
                  onFocus={(event) => event.currentTarget.showPicker?.()}
                  inputMode="none"
                  step={60}
                  className={timeInputClass}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-x-2 gap-y-2">
              <label className="flex w-full flex-col items-start">
                <span className="mb-1 block text-left text-xs text-slate-600">{t('profile_user_profile_lunch')}</span>
                <input
                  type="time"
                  value={lunchTime}
                  onChange={(event) => setLunchTime(event.target.value)}
                  onClick={handleTimePickerOpen}
                  onFocus={(event) => event.currentTarget.showPicker?.()}
                  inputMode="none"
                  step={60}
                  className={timeInputClass}
                />
              </label>
              <label className="flex w-full flex-col items-start">
                <span className="mb-1 block text-left text-xs text-slate-600">{t('profile_user_profile_dinner')}</span>
                <input
                  type="time"
                  value={dinnerTime}
                  onChange={(event) => setDinnerTime(event.target.value)}
                  onClick={handleTimePickerOpen}
                  onFocus={(event) => event.currentTarget.showPicker?.()}
                  inputMode="none"
                  step={60}
                  className={timeInputClass}
                />
              </label>
              <div className="flex flex-col items-start pt-5">
                <button
                  type="button"
                  onClick={() => { void handleSave(); }}
                  disabled={saving || !hasUnsavedChanges}
                  className="min-h-9 rounded-lg border border-transparent px-4 text-xs font-medium text-[#355643] disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)',
                    boxShadow: '0 4px 12px rgba(103,154,121,0.15)',
                  }}
                >
                  {saving ? t('profile_routine_saving') : t('profile_routine_save')}
                </button>
              </div>
            </div>
            {saveText ? <p className="text-xs text-slate-500">{saveText}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

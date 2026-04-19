// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/useAuthStore.ts -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../../store/useAuthStore';
import { APP_MODAL_CARD_CLASS } from '../../lib/modalTheme';
import {
  DEFAULT_WAKE_TIME,
  DEFAULT_SLEEP_TIME,
  DEFAULT_BREAKFAST,
  DEFAULT_LUNCH,
  DEFAULT_DINNER,
  toHour,
} from '../profile/components/userProfilePanelHelpers';
import type { UserProfileManualV2 } from '../../types/userProfile';
import { StepTodo } from './components/StepTodo';

const TOTAL_STEPS = 6;

const ProgressBar: React.FC<{ step: number }> = ({ step }) => (
  <div className="flex gap-1.5 mb-6">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <div
        key={i}
        className={`h-1 flex-1 rounded-full transition-colors ${i < step ? 'bg-[#5F7A63]' : 'bg-slate-200'}`}
      />
    ))}
  </div>
);

const TimeInput: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex flex-col gap-0.5">
    <span className="text-[10px] text-slate-500">{label}</span>
    <input
      type="time" value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[#CBE7D7] bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
    />
  </label>
);

export const OnboardingFlow: React.FC = () => {
  const { t } = useTranslation();
  const { updateUserProfile, userProfileV2 } = useAuthStore();
  const navigate = useNavigate();

  const [step, setStep] = React.useState(1);
  const [saving, setSaving] = React.useState(false);

  // Step 3: 日程类型
  const [hasWorkSchedule, setHasWorkSchedule] = React.useState(false);
  const [hasClassSchedule, setHasClassSchedule] = React.useState(false);

  // Step 4: 作息时间（通用）
  const [wakeTime, setWakeTime] = React.useState(DEFAULT_WAKE_TIME);
  const [sleepTime, setSleepTime] = React.useState(DEFAULT_SLEEP_TIME);
  const [breakfastTime, setBreakfastTime] = React.useState(DEFAULT_BREAKFAST);
  const [lunchTime, setLunchTime] = React.useState(DEFAULT_LUNCH);
  const [dinnerTime, setDinnerTime] = React.useState(DEFAULT_DINNER);

  // Step 4: 工作时间（有工作日程时）
  const [workStart, setWorkStart] = React.useState('09:00');
  const [workEnd, setWorkEnd] = React.useState('18:00');
  const [lunchStart, setLunchStart] = React.useState('12:00');
  const [lunchEnd, setLunchEnd] = React.useState('13:00');

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const requestNotificationPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.requestPermissions();
      } catch { /* web fallback: silent */ }
    }
    next();
  };

  const handleComplete = async () => {
    setSaving(true);
    const mealHours = [breakfastTime, lunchTime, dinnerTime]
      .map(toHour)
      .filter((h): h is number => h !== null);

    const manual: UserProfileManualV2 = {
      ...(userProfileV2?.manual || {}),
      wakeTime: wakeTime || undefined,
      sleepTime: sleepTime || undefined,
      mealTimes: mealHours.length ? mealHours : undefined,
      mealTimesText: [breakfastTime, lunchTime, dinnerTime],
      lunchTime: lunchTime || undefined,
      dinnerTime: dinnerTime || undefined,
      hasWorkSchedule,
      hasClassSchedule,
      workStart: hasWorkSchedule ? (workStart || undefined) : undefined,
      workEnd: hasWorkSchedule ? (workEnd || undefined) : undefined,
      lunchStart: hasWorkSchedule ? (lunchStart || undefined) : undefined,
      lunchEnd: hasWorkSchedule ? (lunchEnd || undefined) : undefined,
      reminderEnabled: true,
    };

    void updateUserProfile({ manual, onboardingCompleted: true });
    setSaving(false);
    navigate('/chat', { replace: true });
  };

  if (step === 3) {
    return (
      <div className="fixed inset-0 z-50 flex bg-[#f4f7f4]">
        <StepTodo onNext={next} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#FCFAF7] px-5">
      <div className={`${APP_MODAL_CARD_CLASS} w-full max-w-sm rounded-3xl px-6 py-8`}>
        <ProgressBar step={step} />

        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-2xl">🌿</p>
              <h2 className="text-xl font-bold text-slate-800">{t('onboarding_step1_title')}</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{t('onboarding_step1_desc')}</p>
            </div>
            <button onClick={next} className="mt-4 w-full rounded-2xl py-3 text-sm font-semibold text-[#2F3E33]"
              style={{ background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)', boxShadow: '0 4px 12px rgba(103,154,121,0.15)' }}>
              {t('onboarding_step1_cta')}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-2xl">🔔</p>
              <h2 className="text-xl font-bold text-slate-800">{t('onboarding_step2_title')}</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{t('onboarding_step2_desc')}</p>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <button onClick={() => { void requestNotificationPermission(); }}
                className="w-full rounded-2xl py-3 text-sm font-semibold text-[#2F3E33]"
                style={{ background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)', boxShadow: '0 4px 12px rgba(103,154,121,0.15)' }}>
                {t('onboarding_step2_allow')}
              </button>
            </div>
            <button onClick={back} className="w-full text-xs text-slate-400 pt-1">{t('onboarding_back')}</button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-2xl">📅</p>
              <h2 className="text-xl font-bold text-slate-800">{t('onboarding_step3_title')}</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{t('onboarding_step3_desc')}</p>
            </div>
            <div className="space-y-3 rounded-2xl bg-[#F7F9F8] px-4 py-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={hasWorkSchedule}
                  onChange={(e) => setHasWorkSchedule(e.target.checked)}
                  className="w-4 h-4 accent-[#5F7A63]" />
                <span className="text-sm text-slate-700">💼 有固定的上班 / 工作时间</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={hasClassSchedule}
                  onChange={(e) => setHasClassSchedule(e.target.checked)}
                  className="w-4 h-4 accent-[#5F7A63]" />
                <span className="text-sm text-slate-700">📚 有固定的上课时间</span>
              </label>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={back} className="flex-1 rounded-2xl py-2.5 text-sm text-slate-500 border border-slate-200">
                {t('onboarding_back')}
              </button>
              <button onClick={next}
                className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-[#2F3E33]"
                style={{ background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)', boxShadow: '0 4px 12px rgba(103,154,121,0.15)' }}>
                {t('onboarding_next')}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-2xl">🌅</p>
              <h2 className="text-xl font-bold text-slate-800">{t('onboarding_step4_title')}</h2>
              <p className="text-sm text-slate-500">{t('onboarding_step4_desc')}</p>
            </div>
            <div className="space-y-3 rounded-2xl bg-[#F7F9F8] px-4 py-3">
              <div className="grid grid-cols-2 gap-2">
                <TimeInput label="🌅 起床" value={wakeTime} onChange={setWakeTime} />
                <TimeInput label="🌙 睡觉" value={sleepTime} onChange={setSleepTime} />
                <TimeInput label="🍞 早餐" value={breakfastTime} onChange={setBreakfastTime} />
                <TimeInput label="🍜 午餐" value={lunchTime} onChange={setLunchTime} />
                <TimeInput label="🍲 晚餐" value={dinnerTime} onChange={setDinnerTime} />
              </div>
              {hasWorkSchedule && (
                <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
                  <TimeInput label="💼 上班开始" value={workStart} onChange={setWorkStart} />
                  <TimeInput label="💼 上班结束" value={workEnd} onChange={setWorkEnd} />
                  <TimeInput label="🛋 午休开始" value={lunchStart} onChange={setLunchStart} />
                  <TimeInput label="🛋 午休结束" value={lunchEnd} onChange={setLunchEnd} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={back} className="flex-1 rounded-2xl py-2.5 text-sm text-slate-500 border border-slate-200">
                {t('onboarding_back')}
              </button>
              <button onClick={next}
                className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-[#2F3E33]"
                style={{ background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)', boxShadow: '0 4px 12px rgba(103,154,121,0.15)' }}>
                {t('onboarding_next')}
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-2xl">✨</p>
              <h2 className="text-xl font-bold text-slate-800">{t('onboarding_step5_title')}</h2>
              <p className="text-sm text-slate-500 leading-relaxed">{t('onboarding_step5_desc')}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={back} className="flex-1 rounded-2xl py-2.5 text-sm text-slate-500 border border-slate-200">
                {t('onboarding_back')}
              </button>
              <button
                onClick={() => { void handleComplete(); }}
                disabled={saving}
                className="flex-1 rounded-2xl py-2.5 text-sm font-semibold text-[#2F3E33] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)', boxShadow: '0 4px 12px rgba(103,154,121,0.15)' }}>
                {saving ? '保存中...' : t('onboarding_step5_cta')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

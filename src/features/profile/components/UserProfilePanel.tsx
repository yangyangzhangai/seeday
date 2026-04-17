// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/用户画像模块_需求与技术文档_v1.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  buildManualPayload,
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
  showHeader?: boolean;
}

function signature(input: {
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  freeText: string;
}): string {
  return JSON.stringify({
    ...input,
    freeText: input.freeText.trim(),
  });
}

export const UserProfilePanel: React.FC<Props> = ({
  plain = false,
  showHeader = true,
}) => {
  const { t } = useTranslation();
  const { userProfileV2, updateUserProfile } = useAuthStore();
  const [expanded, setExpanded] = React.useState(!showHeader);
  const [saving, setSaving] = React.useState(false);
  const [saveText, setSaveText] = React.useState('');

  const [wakeTime, setWakeTime] = React.useState(DEFAULT_WAKE_TIME);
  const [sleepTime, setSleepTime] = React.useState(DEFAULT_SLEEP_TIME);
  const [breakfastTime, setBreakfastTime] = React.useState(DEFAULT_BREAKFAST);
  const [lunchTime, setLunchTime] = React.useState(DEFAULT_LUNCH);
  const [dinnerTime, setDinnerTime] = React.useState(DEFAULT_DINNER);
  const [freeText, setFreeText] = React.useState('');

  const baselineSignature = React.useMemo(() => {
    const manual = userProfileV2?.manual;
    const mealTimesText = Array.isArray(manual?.mealTimesText)
      ? manual.mealTimesText
      : [];
    const mealTimes = Array.isArray(manual?.mealTimes) ? manual.mealTimes : [];
    return signature({
      wakeTime: manual?.wakeTime || DEFAULT_WAKE_TIME,
      sleepTime: manual?.sleepTime || DEFAULT_SLEEP_TIME,
      breakfastTime: mealTimesText[0] || toHourText(mealTimes[0], DEFAULT_BREAKFAST),
      lunchTime: mealTimesText[1] || toHourText(mealTimes[1], DEFAULT_LUNCH),
      dinnerTime: mealTimesText[2] || toHourText(mealTimes[2], DEFAULT_DINNER),
      freeText: manual?.freeText || '',
    });
  }, [userProfileV2]);

  React.useEffect(() => {
    if (!showHeader) {
      setExpanded(true);
    }
  }, [showHeader]);

  React.useEffect(() => {
    const manual = userProfileV2?.manual;
    setWakeTime(manual?.wakeTime || DEFAULT_WAKE_TIME);
    setSleepTime(manual?.sleepTime || DEFAULT_SLEEP_TIME);
    const mealTimesText = Array.isArray(manual?.mealTimesText)
      ? manual.mealTimesText
      : [];
    const mealTimes = Array.isArray(manual?.mealTimes) ? manual?.mealTimes : [];
    setBreakfastTime(mealTimesText[0] || toHourText(mealTimes?.[0], DEFAULT_BREAKFAST));
    setLunchTime(mealTimesText[1] || toHourText(mealTimes?.[1], DEFAULT_LUNCH));
    setDinnerTime(mealTimesText[2] || toHourText(mealTimes?.[2], DEFAULT_DINNER));
    setFreeText(manual?.freeText || '');
  }, [userProfileV2]);

  const mealHours = React.useMemo(() => {
    const parsed = [breakfastTime, lunchTime, dinnerTime]
      .map((item) => toHour(item))
      .filter((item): item is number => typeof item === 'number');
    return Array.from(new Set(parsed));
  }, [breakfastTime, lunchTime, dinnerTime]);

  const currentSignature = React.useMemo(
    () => signature({
      wakeTime,
      sleepTime,
      breakfastTime,
      lunchTime,
      dinnerTime,
      freeText,
    }),
    [
      wakeTime,
      sleepTime,
      breakfastTime,
      lunchTime,
      dinnerTime,
      freeText,
    ],
  );

  const hasUnsavedChanges = currentSignature !== baselineSignature;

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      setSaveText(t('profile_user_profile_no_changes'));
      return;
    }
    setSaveText('');
    setSaving(true);

    const nextManual = buildManualPayload(userProfileV2?.manual, {
      wakeTime,
      sleepTime,
      mealHours,
      mealTimesText: [breakfastTime, lunchTime, dinnerTime],
      freeText,
    });

    const { error } = await updateUserProfile({
      manual: nextManual,
    });

    setSaving(false);
    setSaveText(error ? t('profile_user_profile_save_failed') : t('profile_user_profile_saved'));
  };

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      {showHeader ? (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
        >
          <div className="flex items-start gap-2.5 text-left">
            <Sparkles size={16} strokeWidth={1.5} className="mt-0.5 text-[#5F7A63]" />
            <div>
              <p className="text-xs text-slate-700">{t('profile_user_profile_title')}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('profile_user_profile_desc')}</p>
            </div>
          </div>
          {expanded ? <ChevronUp size={16} strokeWidth={1.5} className="text-slate-400" /> : <ChevronDown size={16} strokeWidth={1.5} className="text-slate-400" />}
        </button>
      ) : null}

      {expanded ? (
        <div className={showHeader ? 'border-t border-slate-200/60 px-4 pb-4 pt-3' : 'px-4 pb-4 pt-3'}>
          <div className="space-y-3">
            <div>
              <p className="mb-2 text-xs text-slate-600">{t('profile_user_profile_tab_schedule')}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_wake_time')}</span>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(event) => setWakeTime(event.target.value)}
                    className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_sleep_time')}</span>
                  <input
                    type="time"
                    value={sleepTime}
                    onChange={(event) => setSleepTime(event.target.value)}
                    className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
                  />
                </label>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_breakfast')}</span>
                  <input
                    type="time"
                    value={breakfastTime}
                    onChange={(event) => setBreakfastTime(event.target.value)}
                    className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-2 text-xs text-slate-700 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_lunch')}</span>
                  <input
                    type="time"
                    value={lunchTime}
                    onChange={(event) => setLunchTime(event.target.value)}
                    className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-2 text-xs text-slate-700 outline-none"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_dinner')}</span>
                  <input
                    type="time"
                    value={dinnerTime}
                    onChange={(event) => setDinnerTime(event.target.value)}
                    className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-2 text-xs text-slate-700 outline-none"
                  />
                </label>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_tab_personalization')}</span>
              <textarea
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                placeholder={t('profile_user_profile_personalization_placeholder')}
                rows={6}
                className="w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none"
              />
            </label>

            <div className="pt-1">
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
                {saving ? t('profile_user_profile_saving') : t('profile_user_profile_save')}
              </button>
              {saveText ? <p className="mt-2 text-xs text-slate-500">{saveText}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

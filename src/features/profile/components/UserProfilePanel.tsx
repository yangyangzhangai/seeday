// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/用户画像模块_需求与技术文档_v1.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Sparkles, Plus, Trash2 } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import type { PrimaryUse } from '../../../types/userProfile';
import {
  buildAnniversariesPayload,
  buildManualPayload,
  createAnniversaryId,
  DEFAULT_BREAKFAST,
  DEFAULT_DINNER,
  DEFAULT_LUNCH,
  DEFAULT_SLEEP_TIME,
  DEFAULT_WAKE_TIME,
  hasPartialAnniversaryDraft,
  MAX_ANNIVERSARIES,
  toAnniversaryDrafts,
  toHour,
  toHourText,
  type AnniversaryDraft,
} from './userProfilePanelHelpers';

interface Props {
  plain?: boolean;
}

function signature(input: {
  primaryUse: PrimaryUse | '';
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  currentGoal: string;
  lifeGoal: string;
  anniversaries: AnniversaryDraft[];
}): string {
  const normalizedAnniversaries = input.anniversaries.map((item) => ({
    label: item.label.trim(),
    dateInput: item.dateInput,
    repeating: item.repeating,
  }));
  return JSON.stringify({
    ...input,
    currentGoal: input.currentGoal.trim(),
    lifeGoal: input.lifeGoal.trim(),
    anniversaries: normalizedAnniversaries,
  });
}

export const UserProfilePanel: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const { userProfileV2, updateUserProfile } = useAuthStore();
  const [expanded, setExpanded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveText, setSaveText] = React.useState('');

  const [primaryUse, setPrimaryUse] = React.useState<PrimaryUse | ''>('');
  const [wakeTime, setWakeTime] = React.useState(DEFAULT_WAKE_TIME);
  const [sleepTime, setSleepTime] = React.useState(DEFAULT_SLEEP_TIME);
  const [breakfastTime, setBreakfastTime] = React.useState(DEFAULT_BREAKFAST);
  const [lunchTime, setLunchTime] = React.useState(DEFAULT_LUNCH);
  const [dinnerTime, setDinnerTime] = React.useState(DEFAULT_DINNER);
  const [currentGoal, setCurrentGoal] = React.useState('');
  const [lifeGoal, setLifeGoal] = React.useState('');
  const [anniversaries, setAnniversaries] = React.useState<AnniversaryDraft[]>([]);

  const baselineSignature = React.useMemo(() => {
    const manual = userProfileV2?.manual;
    const mealTimes = Array.isArray(manual?.mealTimes) ? manual.mealTimes : [];
    return signature({
      primaryUse: (manual?.primaryUse as PrimaryUse | undefined) || '',
      wakeTime: manual?.wakeTime || DEFAULT_WAKE_TIME,
      sleepTime: manual?.sleepTime || DEFAULT_SLEEP_TIME,
      breakfastTime: toHourText(mealTimes[0], DEFAULT_BREAKFAST),
      lunchTime: toHourText(mealTimes[1], DEFAULT_LUNCH),
      dinnerTime: toHourText(mealTimes[2], DEFAULT_DINNER),
      currentGoal: manual?.currentGoal || '',
      lifeGoal: manual?.lifeGoal || '',
      anniversaries: toAnniversaryDrafts(userProfileV2?.anniversariesVisible),
    });
  }, [userProfileV2]);

  React.useEffect(() => {
    const manual = userProfileV2?.manual;
    setPrimaryUse((manual?.primaryUse as PrimaryUse | undefined) || '');
    setWakeTime(manual?.wakeTime || DEFAULT_WAKE_TIME);
    setSleepTime(manual?.sleepTime || DEFAULT_SLEEP_TIME);
    const mealTimes = Array.isArray(manual?.mealTimes) ? manual?.mealTimes : [];
    setBreakfastTime(toHourText(mealTimes?.[0], DEFAULT_BREAKFAST));
    setLunchTime(toHourText(mealTimes?.[1], DEFAULT_LUNCH));
    setDinnerTime(toHourText(mealTimes?.[2], DEFAULT_DINNER));
    setCurrentGoal(manual?.currentGoal || '');
    setLifeGoal(manual?.lifeGoal || '');
    setAnniversaries(toAnniversaryDrafts(userProfileV2?.anniversariesVisible));
  }, [userProfileV2]);

  const mealHours = React.useMemo(() => {
    const parsed = [breakfastTime, lunchTime, dinnerTime]
      .map((item) => toHour(item))
      .filter((item): item is number => typeof item === 'number');
    return Array.from(new Set(parsed));
  }, [breakfastTime, lunchTime, dinnerTime]);

  const currentSignature = React.useMemo(
    () => signature({
      primaryUse,
      wakeTime,
      sleepTime,
      breakfastTime,
      lunchTime,
      dinnerTime,
      currentGoal,
      lifeGoal,
      anniversaries,
    }),
    [
      primaryUse,
      wakeTime,
      sleepTime,
      breakfastTime,
      lunchTime,
      dinnerTime,
      currentGoal,
      lifeGoal,
      anniversaries,
    ],
  );

  const hasUnsavedChanges = currentSignature !== baselineSignature;

  const handleAddAnniversary = () => {
    if (anniversaries.length >= MAX_ANNIVERSARIES) {
      setSaveText(t('profile_user_profile_anni_limit'));
      return;
    }
    setAnniversaries((prev) => [
      ...prev,
      {
        id: createAnniversaryId(),
        label: '',
        dateInput: '',
        repeating: true,
        source: 'user',
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      setSaveText(t('profile_user_profile_no_changes'));
      return;
    }
    if (hasPartialAnniversaryDraft(anniversaries)) {
      setSaveText(t('profile_user_profile_partial_anniversary'));
      return;
    }
    setSaveText('');
    setSaving(true);

    const nextManual = buildManualPayload(userProfileV2?.manual, {
      primaryUse,
      wakeTime,
      sleepTime,
      mealHours,
      currentGoal,
      lifeGoal,
    });
    const nextAnniversaries = buildAnniversariesPayload(anniversaries);

    const { error } = await updateUserProfile({
      manual: nextManual,
      anniversariesVisible: nextAnniversaries,
    });

    setSaving(false);
    setSaveText(error ? t('profile_user_profile_save_failed') : t('profile_user_profile_saved'));
  };

  const usageOptions: Array<{ value: PrimaryUse; labelKey: string }> = [
    { value: 'life_record', labelKey: 'profile_user_profile_use_life_record' },
    { value: 'organize_thoughts', labelKey: 'profile_user_profile_use_organize_thoughts' },
    { value: 'emotion_management', labelKey: 'profile_user_profile_use_emotion_management' },
    { value: 'habit_building', labelKey: 'profile_user_profile_use_habit_building' },
  ];

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
      >
        <div className="flex items-start gap-2.5 text-left">
          <Sparkles size={16} className="mt-0.5 text-[#5F7A63]" />
          <div>
            <p className="text-xs text-slate-700">{t('profile_user_profile_title')}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('profile_user_profile_desc')}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {expanded ? (
        <div className="border-t border-slate-200/60 px-4 pb-4 pt-3">
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_primary_use')}</span>
              <select
                value={primaryUse}
                onChange={(event) => setPrimaryUse(event.target.value as PrimaryUse | '')}
                className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
              >
                <option value="">{t('profile_user_profile_select_placeholder')}</option>
                {usageOptions.map((item) => (
                  <option key={item.value} value={item.value}>{t(item.labelKey)}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_wake_time')}</span>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(event) => setWakeTime(event.target.value)}
                  className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_sleep_time')}</span>
                <input
                  type="time"
                  value={sleepTime}
                  onChange={(event) => setSleepTime(event.target.value)}
                  className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_breakfast')}</span>
                <input
                  type="time"
                  value={breakfastTime}
                  onChange={(event) => setBreakfastTime(event.target.value)}
                  className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-2 text-xs text-slate-700 outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_lunch')}</span>
                <input
                  type="time"
                  value={lunchTime}
                  onChange={(event) => setLunchTime(event.target.value)}
                  className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-2 text-xs text-slate-700 outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_dinner')}</span>
                <input
                  type="time"
                  value={dinnerTime}
                  onChange={(event) => setDinnerTime(event.target.value)}
                  className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-2 text-xs text-slate-700 outline-none"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_current_goal')}</span>
              <input
                type="text"
                value={currentGoal}
                onChange={(event) => setCurrentGoal(event.target.value)}
                placeholder={t('profile_user_profile_current_goal_placeholder')}
                className="min-h-9 w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-600">{t('profile_user_profile_life_goal')}</span>
              <textarea
                value={lifeGoal}
                onChange={(event) => setLifeGoal(event.target.value)}
                placeholder={t('profile_user_profile_life_goal_placeholder')}
                rows={2}
                className="w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-600">{t('profile_user_profile_anniversaries')}</span>
                <button
                  type="button"
                  onClick={handleAddAnniversary}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-[#CBE7D7] bg-white/85 px-2.5 text-[11px] text-[#355643]"
                >
                  <Plus size={12} />
                  {t('profile_user_profile_add_anniversary')}
                </button>
              </div>

              <div className="space-y-2">
                {anniversaries.length === 0 ? (
                  <p className="text-[11px] text-slate-500">{t('profile_user_profile_anniversary_empty')}</p>
                ) : (
                  anniversaries.map((item) => (
                    <div key={item.id} className="rounded-lg border border-[#DDEBE3] bg-white/70 p-2.5">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          type="text"
                          value={item.label}
                          onChange={(event) => {
                            const next = event.target.value;
                            setAnniversaries((prev) => prev.map((entry) => (
                              entry.id === item.id ? { ...entry, label: next } : entry
                            )));
                          }}
                          placeholder={t('profile_user_profile_anni_label_placeholder')}
                          className="min-h-9 rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setAnniversaries((prev) => prev.filter((entry) => entry.id !== item.id))}
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50/70 text-rose-500"
                          aria-label={t('profile_user_profile_remove_anniversary')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
                        <input
                          type="date"
                          value={item.dateInput}
                          onChange={(event) => {
                            const next = event.target.value;
                            setAnniversaries((prev) => prev.map((entry) => (
                              entry.id === item.id ? { ...entry, dateInput: next } : entry
                            )));
                          }}
                          className="min-h-9 rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
                        />
                        <label className="inline-flex min-h-9 items-center gap-1.5 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={item.repeating}
                            onChange={(event) => {
                              const next = event.target.checked;
                              setAnniversaries((prev) => prev.map((entry) => (
                                entry.id === item.id ? { ...entry, repeating: next } : entry
                              )));
                            }}
                          />
                          {t('profile_user_profile_anni_repeat')}
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

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
              {saveText ? <p className="mt-2 text-[11px] text-slate-500">{saveText}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

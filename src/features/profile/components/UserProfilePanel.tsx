// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Sparkles, Bell, ExternalLink } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  buildAIMemoryManualPayload,
} from './userProfilePanelHelpers';
import type { UserProfileManualV2 } from '../../../types/userProfile';

interface Props {
  plain?: boolean;
  showHeader?: boolean;
}

function signature(input: {
  freeText: string;
  hasWorkSchedule: boolean;
  hasClassSchedule: boolean;
  workStart: string;
  workEnd: string;
  lunchStart: string;
  lunchEnd: string;
  wakeTime: string;
  sleepTime: string;
  lunchTime: string;
  dinnerTime: string;
  reminderEnabled: boolean;
}): string {
  return JSON.stringify(input);
}

/** 从 manual 安全读取 UserProfileManualV2 扩展字段 */
function readV2(manual: UserProfileManualV2 | undefined) {
  return {
    hasWorkSchedule: manual?.hasWorkSchedule ?? false,
    hasClassSchedule: manual?.hasClassSchedule ?? false,
    workStart: manual?.workStart ?? '',
    workEnd: manual?.workEnd ?? '',
    lunchStart: manual?.lunchStart ?? '',
    lunchEnd: manual?.lunchEnd ?? '',
    wakeTime: manual?.wakeTime ?? '',
    sleepTime: manual?.sleepTime ?? '',
    lunchTime: manual?.lunchTime ?? '',
    dinnerTime: manual?.dinnerTime ?? '',
    reminderEnabled: manual?.reminderEnabled ?? true,
    freeText: manual?.freeText ?? '',
  };
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

  const manual = userProfileV2?.manual as UserProfileManualV2 | undefined;
  const initial = React.useMemo(() => readV2(manual), [userProfileV2]);

  const [freeText, setFreeText] = React.useState(initial.freeText);
  const [hasWorkSchedule, setHasWorkSchedule] = React.useState(initial.hasWorkSchedule);
  const [hasClassSchedule, setHasClassSchedule] = React.useState(initial.hasClassSchedule);
  const [workStart, setWorkStart] = React.useState(initial.workStart);
  const [workEnd, setWorkEnd] = React.useState(initial.workEnd);
  const [lunchStart, setLunchStart] = React.useState(initial.lunchStart);
  const [lunchEnd, setLunchEnd] = React.useState(initial.lunchEnd);
  const [wakeTime, setWakeTime] = React.useState(initial.wakeTime);
  const [sleepTime, setSleepTime] = React.useState(initial.sleepTime);
  const [lunchTime, setLunchTime] = React.useState(initial.lunchTime);
  const [dinnerTime, setDinnerTime] = React.useState(initial.dinnerTime);
  const [reminderEnabled, setReminderEnabled] = React.useState(initial.reminderEnabled);

  React.useEffect(() => {
    if (!showHeader) setExpanded(true);
  }, [showHeader]);

  // 同步外部数据变更（如 onboarding 写入后）
  React.useEffect(() => {
    const v = readV2(userProfileV2?.manual as UserProfileManualV2 | undefined);
    setFreeText(v.freeText);
    setHasWorkSchedule(v.hasWorkSchedule);
    setHasClassSchedule(v.hasClassSchedule);
    setWorkStart(v.workStart);
    setWorkEnd(v.workEnd);
    setLunchStart(v.lunchStart);
    setLunchEnd(v.lunchEnd);
    setWakeTime(v.wakeTime);
    setSleepTime(v.sleepTime);
    setLunchTime(v.lunchTime);
    setDinnerTime(v.dinnerTime);
    setReminderEnabled(v.reminderEnabled);
  }, [userProfileV2]);

  const baselineSig = React.useMemo(() => signature(initial), [initial]);
  const currentSig = React.useMemo(() => signature({
    freeText, hasWorkSchedule, hasClassSchedule,
    workStart, workEnd, lunchStart, lunchEnd,
    wakeTime, sleepTime, lunchTime, dinnerTime,
    reminderEnabled,
  }), [freeText, hasWorkSchedule, hasClassSchedule, workStart, workEnd, lunchStart, lunchEnd, wakeTime, sleepTime, lunchTime, dinnerTime, reminderEnabled]);

  const hasUnsavedChanges = currentSig !== baselineSig;

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      setSaveText(t('profile_user_profile_no_changes'));
      return;
    }
    setSaveText('');
    setSaving(true);

    const nextManual = buildAIMemoryManualPayload(userProfileV2?.manual, { freeText });
    const scheduleFields: Partial<UserProfileManualV2> = {
      hasWorkSchedule,
      hasClassSchedule,
      workStart: workStart || undefined,
      workEnd: workEnd || undefined,
      lunchStart: lunchStart || undefined,
      lunchEnd: lunchEnd || undefined,
      wakeTime: wakeTime || undefined,
      sleepTime: sleepTime || undefined,
      lunchTime: lunchTime || undefined,
      dinnerTime: dinnerTime || undefined,
      reminderEnabled,
    };

    const { error } = await updateUserProfile({
      manual: { ...nextManual, ...scheduleFields } as UserProfileManualV2,
    });

    setSaving(false);
    setSaveText(error ? t('profile_user_profile_save_failed') : t('profile_user_profile_saved'));

    // 提醒开关关闭时取消今日调度标记（次日重调度）
    if (!reminderEnabled) {
      localStorage.removeItem('reminder_scheduled_date');
    }
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
              <p className="profile-fn-title">{t('profile_user_profile_title')}</p>
              <p className="mt-0.5 text-[10px] font-light leading-tight text-slate-500">{t('profile_user_profile_desc')}</p>
            </div>
          </div>
          {expanded ? <ChevronUp size={16} strokeWidth={1.5} className="text-slate-400" /> : <ChevronDown size={16} strokeWidth={1.5} className="text-slate-400" />}
        </button>
      ) : null}

      {expanded ? (
        <div className={showHeader ? 'border-t border-slate-200/60 px-4 pb-4 pt-3' : 'px-4 pb-4 pt-3'}>
          <div className="space-y-4">

            {/* ── A. 我的日程 ── */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">{t('profile_schedule_section_title')}</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasWorkSchedule}
                    onChange={(e) => setHasWorkSchedule(e.target.checked)}
                    className="w-4 h-4 accent-[#5F7A63]"
                  />
                  <span className="text-xs text-slate-700">{t('profile_user_profile_has_work_schedule')}</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasClassSchedule}
                    onChange={(e) => setHasClassSchedule(e.target.checked)}
                    className="w-4 h-4 accent-[#5F7A63]"
                  />
                  <span className="text-xs text-slate-700">{t('profile_user_profile_has_class_schedule')}</span>
                </label>
              </div>
            </div>

            {/* ── B. 作息时间 ── */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">{t('profile_user_profile_tab_schedule')}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <TimeField label={t('profile_user_profile_wake_time')} value={wakeTime} onChange={setWakeTime} emoji="🌅" />
                <TimeField label={t('profile_user_profile_sleep_time')} value={sleepTime} onChange={setSleepTime} emoji="🌙" />
                {!hasWorkSchedule && (
                  <TimeField label={t('profile_user_profile_lunch')} value={lunchTime} onChange={setLunchTime} emoji="🍜" />
                )}
                <TimeField label={t('profile_schedule_dinner_time')} value={dinnerTime} onChange={setDinnerTime} emoji="🍲" />
              </div>

              {/* 工作日程字段 */}
              {hasWorkSchedule && (
                <div className="mt-3 rounded-xl bg-[#F0F7F2] p-3 space-y-2">
                  <p className="text-[10px] text-slate-500">💼 {t('profile_schedule_work_fields')}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <TimeField label={t('profile_user_profile_work_start')} value={workStart} onChange={setWorkStart} />
                    <TimeField label={t('profile_user_profile_work_end')} value={workEnd} onChange={setWorkEnd} />
                    <TimeField label={t('profile_user_profile_lunch_start')} value={lunchStart} onChange={setLunchStart} />
                    <TimeField label={t('profile_user_profile_lunch_end')} value={lunchEnd} onChange={setLunchEnd} />
                  </div>
                </div>
              )}

              {/* 课表字段（Phase 2：仅显示手动时间，不含图片导入） */}
              {hasClassSchedule && (
                <div className="mt-3 rounded-xl bg-[#F0F7F2] p-3 space-y-2">
                  <p className="text-[10px] text-slate-500">📚 {t('profile_schedule_class_fields')}</p>
                  <p className="text-[10px] text-slate-400">{t('profile_schedule_class_phase2_hint')}</p>
                </div>
              )}
            </div>

            {/* ── C. 主动提醒 ── */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <Bell size={14} color="#5F7A63" />
                  <span className="text-xs font-medium text-slate-600">{t('profile_user_profile_reminder_enable')}</span>
                </div>
                <Toggle value={reminderEnabled} onChange={setReminderEnabled} />
              </label>
            </div>

            {/* ── D. 个性化说明 ── */}
            <label className="block">
              <span className="mb-1 block text-xs text-slate-600">{t('profile_user_profile_tab_personalization')}</span>
              <textarea
                value={freeText}
                onChange={(event) => setFreeText(event.target.value)}
                placeholder={t('profile_user_profile_personalization_placeholder')}
                rows={4}
                className="w-full rounded-lg border border-[#CBE7D7] bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none"
              />
            </label>

            {/* 保存按钮 */}
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

// ─────────────────────────────────────────────
// 小组件
// ─────────────────────────────────────────────

const TimeField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  emoji?: string;
}> = ({ label, value, onChange, emoji }) => (
  <label className="flex flex-col gap-0.5">
    <span className="text-[10px] text-slate-500">{emoji ? `${emoji} ` : ''}{label}</span>
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[#CBE7D7] bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
    />
  </label>
);

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-[#5F7A63]' : 'bg-slate-200'}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`}
    />
  </button>
);

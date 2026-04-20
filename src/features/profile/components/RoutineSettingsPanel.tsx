// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Clock3, X, ChevronDown, Bell } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { checkNotificationPermission, requestNotificationPermission } from '../../../services/notifications/localNotificationService';
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
import type { UserProfileManualV2, ClassSchedule } from '../../../types/userProfile';

interface Props { plain?: boolean; }
type IdentityType = 'none' | 'work' | 'class';

interface RoutineSnapshot {
  wakeTime: string; sleepTime: string;
  breakfastTime: string; lunchTime: string; dinnerTime: string;
  reminderEnabled?: boolean;
}

interface RoutineFormSignature {
  identity: IdentityType;
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  workStart: string;
  workLunchStart: string;
  workLunchEnd: string;
  workEnd: string;
  classMorningStart: string;
  classMorningEnd: string;
  classAfternoonStart: string;
  classAfternoonEnd: string;
  classEveningStart: string;
  classEveningEnd: string;
  reminderEnabled: boolean;
}

const ROUTINE_STORAGE_PREFIX = 'profile:routine:v1:';
const TIME_TEXT_PATTERN = /^\d{2}:\d{2}$/;

function getRoutineStorageKey(userId: string | null | undefined) {
  return `${ROUTINE_STORAGE_PREFIX}${userId || 'guest'}`;
}
function readRoutineSnapshot(key: string): RoutineSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<RoutineSnapshot>;
    const ok = (v: unknown) => typeof v === 'string' && TIME_TEXT_PATTERN.test(v);
    if (!ok(p.wakeTime) || !ok(p.sleepTime) || !ok(p.breakfastTime) || !ok(p.lunchTime) || !ok(p.dinnerTime)) return null;
    const reminderEnabled = typeof p.reminderEnabled === 'boolean' ? p.reminderEnabled : undefined;
    return {
      wakeTime: p.wakeTime as string,
      sleepTime: p.sleepTime as string,
      breakfastTime: p.breakfastTime as string,
      lunchTime: p.lunchTime as string,
      dinnerTime: p.dinnerTime as string,
      ...(typeof reminderEnabled === 'boolean' ? { reminderEnabled } : {}),
    };
  } catch { return null; }
}
function writeRoutineSnapshot(key: string, s: RoutineSnapshot) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(s));
}
function buildClassSchedule(
  ms: string, me: string, as_: string, ae: string, es: string, ee: string,
): ClassSchedule | undefined {
  const morning = ms && me ? { start: ms, end: me } : undefined;
  const afternoon = as_ && ae ? { start: as_, end: ae } : undefined;
  const evening = es && ee ? { start: es, end: ee } : undefined;
  if (!morning && !afternoon && !evening) return undefined;
  return { weekdays: [1, 2, 3, 4, 5], morning, afternoon, evening };
}
function routineSig(v: RoutineSnapshot) {
  return JSON.stringify({
    wakeTime: v.wakeTime,
    sleepTime: v.sleepTime,
    breakfastTime: v.breakfastTime,
    lunchTime: v.lunchTime,
    dinnerTime: v.dinnerTime,
  });
}
function fullRoutineSig(v: RoutineFormSignature) { return JSON.stringify(v); }

// ─── DrumColumn ───────────────────────────────────────────────
const ITEM_H = 40;

const DrumColumn: React.FC<{
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
}> = ({ items, selected, onSelect }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  // Scroll to initial position on mount
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.indexOf(selected);
    if (idx >= 0) el.scrollTop = idx * ITEM_H;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (items[clamped] !== selected) onSelect(items[clamped]);
  };

  return (
    <div ref={ref} onScroll={handleScroll}
      className="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-16"
      style={{ overscrollBehavior: 'contain' }}>
      {items.map((item) => (
        <div key={item}
          className={`h-10 flex items-center justify-center snap-center transition-all duration-150 ${
            selected === item ? 'text-black text-lg font-black' : 'text-black/20 text-sm'
          }`}>
          {item}
        </div>
      ))}
    </div>
  );
};

// ─── TimePicker ───────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const TimePicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempHour, setTempHour] = React.useState(value.split(':')[0]);
  const [tempMinute, setTempMinute] = React.useState(value.split(':')[1]);

  // Sync temp values when picker is closed and external value changes
  React.useEffect(() => {
    if (!isOpen) {
      setTempHour(value.split(':')[0]);
      setTempMinute(value.split(':')[1]);
    }
  }, [value, isOpen]);

  const save = () => { onChange(`${tempHour}:${tempMinute}`); setIsOpen(false); };
  const openPicker = () => {
    const [hour = '00', minute = '00'] = value.split(':');
    setTempHour(hour);
    setTempMinute(minute);
    setIsOpen(true);
  };

  return (
    <div className={`relative transition-all duration-300 ${isOpen ? 'z-[60]' : 'z-0'}`}>
      <button onClick={() => { if (isOpen) setIsOpen(false); else openPicker(); }}
        className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 border-2 ${isOpen ? 'bg-white border-black shadow-xl shadow-black/5' : 'bg-zinc-50 border-transparent hover:border-black/10'} text-sm font-bold text-black group relative z-[2]`}>
        <span>{value}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="text-black/20 group-hover:text-black transition-colors">
          <ChevronDown size={14} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="absolute left-0 right-0 mt-2 rounded-[24px] bg-white border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[50] overflow-hidden">
              <div className="flex justify-center items-center h-40 relative px-6 gap-2 border-b border-zinc-50">
                <div className="absolute inset-x-8 h-10 border-y border-black/5 pointer-events-none" />
                <DrumColumn items={HOURS} selected={tempHour} onSelect={setTempHour} />
                <span className="text-lg font-black text-black">:</span>
                <DrumColumn items={MINUTES} selected={tempMinute} onSelect={setTempMinute} />
              </div>
              <div className="p-2 flex gap-2 bg-zinc-50/20">
                <button onClick={() => setIsOpen(false)} className="flex-1 py-2 rounded-xl text-[9px] font-bold text-black/40 hover:text-black transition-colors uppercase tracking-[0.2em]">取消</button>
                <button onClick={save} className="flex-1 py-2 rounded-xl bg-black text-white text-[9px] font-bold shadow-sm uppercase tracking-[0.2em]">确定</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar{display:none}` }} />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
export const RoutineSettingsPanel: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const { userProfileV2, updateUserProfile, user } = useAuthStore();
  const [showModal, setShowModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveText, setSaveText] = React.useState('');
  // Lock body scroll when modal is open to prevent scroll-through on mobile
  React.useEffect(() => {
    if (showModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [showModal]);

  const [identity, setIdentity] = React.useState<IdentityType>('none');
  const [pendingIdentity, setPendingIdentity] = React.useState<IdentityType | null>(null);
  const [wakeTime, setWakeTime] = React.useState(DEFAULT_WAKE_TIME);
  const [sleepTime, setSleepTime] = React.useState(DEFAULT_SLEEP_TIME);
  const [breakfastTime, setBreakfastTime] = React.useState(DEFAULT_BREAKFAST);
  const [lunchTime, setLunchTime] = React.useState(DEFAULT_LUNCH);
  const [dinnerTime, setDinnerTime] = React.useState(DEFAULT_DINNER);
  const [workStart, setWorkStart] = React.useState('09:00');
  const [workLunchStart, setWorkLunchStart] = React.useState('12:00');
  const [workLunchEnd, setWorkLunchEnd] = React.useState('13:30');
  const [workEnd, setWorkEnd] = React.useState('18:00');
  const [classMorningStart, setClassMorningStart] = React.useState('08:30');
  const [classMorningEnd, setClassMorningEnd] = React.useState('11:45');
  const [classAfternoonStart, setClassAfternoonStart] = React.useState('14:00');
  const [classAfternoonEnd, setClassAfternoonEnd] = React.useState('17:30');
  const [classEveningStart, setClassEveningStart] = React.useState('19:00');
  const [classEveningEnd, setClassEveningEnd] = React.useState('21:00');
  const [reminderEnabled, setReminderEnabled] = React.useState(true);
  const [notifPermission, setNotifPermission] = React.useState<string | null>(null);
  const [todayCount, setTodayCount] = React.useState<number | null>(null);

  const storageKey = React.useMemo(() => getRoutineStorageKey(user?.id), [user?.id]);

  const cloudSnapshot = React.useMemo<RoutineSnapshot>(() => {
    const m = userProfileV2?.manual;
    const mtt = Array.isArray(m?.mealTimesText) ? m.mealTimesText : [];
    const mt = Array.isArray(m?.mealTimes) ? m.mealTimes : [];
    return {
      wakeTime: m?.wakeTime || DEFAULT_WAKE_TIME,
      sleepTime: m?.sleepTime || DEFAULT_SLEEP_TIME,
      breakfastTime: mtt[0] || toHourText(mt[0], DEFAULT_BREAKFAST),
      lunchTime: mtt[1] || toHourText(mt[1], DEFAULT_LUNCH),
      dinnerTime: mtt[2] || toHourText(mt[2], DEFAULT_DINNER),
    };
  }, [userProfileV2]);

  const localSnapshot = React.useMemo(
    () => readRoutineSnapshot(storageKey),
    [storageKey, userProfileV2],
  );
  const resolved = localSnapshot || cloudSnapshot;
  const baselineSig = React.useMemo(() => routineSig(resolved), [resolved]);

  React.useEffect(() => {
    setWakeTime(resolved.wakeTime); setSleepTime(resolved.sleepTime);
    setBreakfastTime(resolved.breakfastTime); setLunchTime(resolved.lunchTime);
    setDinnerTime(resolved.dinnerTime);
  }, [resolved]);

  React.useEffect(() => {
    const v2 = userProfileV2?.manual as UserProfileManualV2 | undefined;
    if (v2?.hasWorkSchedule) setIdentity('work');
    else if (v2?.hasClassSchedule) setIdentity('class');
    else setIdentity('none');
    setWorkStart(v2?.workStart ?? '09:00');
    setWorkEnd(v2?.workEnd ?? '18:00');
    setWorkLunchStart(v2?.lunchStart ?? '12:00');
    setWorkLunchEnd(v2?.lunchEnd ?? '13:30');
    setClassMorningStart(v2?.classSchedule?.morning?.start ?? '08:30');
    setClassMorningEnd(v2?.classSchedule?.morning?.end ?? '11:45');
    setClassAfternoonStart(v2?.classSchedule?.afternoon?.start ?? '14:00');
    setClassAfternoonEnd(v2?.classSchedule?.afternoon?.end ?? '17:30');
    setClassEveningStart(v2?.classSchedule?.evening?.start ?? '19:00');
    setClassEveningEnd(v2?.classSchedule?.evening?.end ?? '21:00');
    setReminderEnabled(v2?.reminderEnabled ?? localSnapshot?.reminderEnabled ?? true);
  }, [userProfileV2, localSnapshot?.reminderEnabled]);

  React.useEffect(() => {
    const count = localStorage.getItem('reminder_today_count');
    if (count !== null) setTodayCount(Number(count));
    if (!Capacitor.isNativePlatform()) return;
    checkNotificationPermission().then((status) => setNotifPermission(status)).catch(() => {});
  }, []);

  const currentSig = React.useMemo(
    () => routineSig({ wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime }),
    [wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime],
  );
  const mealHours = React.useMemo(() => {
    return Array.from(new Set(
      [breakfastTime, lunchTime, dinnerTime].map(toHour).filter((h): h is number => h !== null),
    ));
  }, [breakfastTime, lunchTime, dinnerTime]);

  const hasUnsavedChanges = currentSig !== baselineSig;
  const savedIdentity = React.useMemo<IdentityType>(() => {
    const v2 = userProfileV2?.manual as UserProfileManualV2 | undefined;
    return v2?.hasWorkSchedule ? 'work' : v2?.hasClassSchedule ? 'class' : 'none';
  }, [userProfileV2?.manual]);

  const baselineFullSig = React.useMemo(() => {
    const v2 = userProfileV2?.manual as UserProfileManualV2 | undefined;
    const baselineIdentity: IdentityType = v2?.hasWorkSchedule ? 'work' : v2?.hasClassSchedule ? 'class' : 'none';
    return fullRoutineSig({
      identity: baselineIdentity,
      wakeTime: resolved.wakeTime,
      sleepTime: resolved.sleepTime,
      breakfastTime: resolved.breakfastTime,
      lunchTime: resolved.lunchTime,
      dinnerTime: resolved.dinnerTime,
      workStart: v2?.workStart ?? '09:00',
      workLunchStart: v2?.lunchStart ?? '12:00',
      workLunchEnd: v2?.lunchEnd ?? '13:30',
      workEnd: v2?.workEnd ?? '18:00',
      classMorningStart: v2?.classSchedule?.morning?.start ?? '08:30',
      classMorningEnd: v2?.classSchedule?.morning?.end ?? '11:45',
      classAfternoonStart: v2?.classSchedule?.afternoon?.start ?? '14:00',
      classAfternoonEnd: v2?.classSchedule?.afternoon?.end ?? '17:30',
      classEveningStart: v2?.classSchedule?.evening?.start ?? '19:00',
      classEveningEnd: v2?.classSchedule?.evening?.end ?? '21:00',
      reminderEnabled: v2?.reminderEnabled ?? true,
    });
  }, [
    resolved,
    userProfileV2?.manual,
  ]);
  const currentFullSig = React.useMemo(() => fullRoutineSig({
    identity,
    wakeTime,
    sleepTime,
    breakfastTime,
    lunchTime,
    dinnerTime,
    workStart,
    workLunchStart,
    workLunchEnd,
    workEnd,
    classMorningStart,
    classMorningEnd,
    classAfternoonStart,
    classAfternoonEnd,
    classEveningStart,
    classEveningEnd,
    reminderEnabled,
  }), [
    identity,
    wakeTime,
    sleepTime,
    breakfastTime,
    lunchTime,
    dinnerTime,
    workStart,
    workLunchStart,
    workLunchEnd,
    workEnd,
    classMorningStart,
    classMorningEnd,
    classAfternoonStart,
    classAfternoonEnd,
    classEveningStart,
    classEveningEnd,
    reminderEnabled,
  ]);

  const hasFullUnsavedChanges = hasUnsavedChanges || currentFullSig !== baselineFullSig;

  const performSave = async () => {
    if (saving) return;
    if (!hasFullUnsavedChanges) { setSaveText(t('profile_routine_no_changes')); return; }
    setSaveText('');
    setSaving(true);
    // Persist locally first, then sync to Supabase in background.
    writeRoutineSnapshot(storageKey, { wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime, reminderEnabled });
    localStorage.removeItem('reminder_scheduled_date');

    const hasWork = identity === 'work';
    const hasClass = identity === 'class';
    const baseManual = buildRoutineManualPayload(userProfileV2?.manual, {
      wakeTime, sleepTime, mealHours, mealTimesText: [breakfastTime, lunchTime, dinnerTime],
    });
    const v2Extra: Partial<UserProfileManualV2> = {
      hasWorkSchedule: hasWork, hasClassSchedule: hasClass,
      workStart: hasWork ? (workStart || undefined) : undefined,
      workEnd: hasWork ? (workEnd || undefined) : undefined,
      lunchStart: hasWork ? (workLunchStart || undefined) : undefined,
      lunchEnd: hasWork ? (workLunchEnd || undefined) : undefined,
      lunchTime: lunchTime || undefined, dinnerTime: dinnerTime || undefined,
      reminderEnabled,
      classSchedule: hasClass ? buildClassSchedule(
        classMorningStart, classMorningEnd, classAfternoonStart,
        classAfternoonEnd, classEveningStart, classEveningEnd,
      ) : undefined,
      classScheduleSource: hasClass ? 'manual' : undefined,
    };
    const { error } = await updateUserProfile({ manual: { ...baseManual, ...v2Extra } as UserProfileManualV2 });
    if (error) {
      // Keep local save result; cloud sync can retry later.
      console.warn('[RoutineSettingsPanel] local save done, cloud sync failed:', error);
    }
    setSaving(false);
    setSaveText(t('profile_routine_saved'));
    setTimeout(() => setShowModal(false), 600);
  };
  const requestCloseModal = () => {
    if (saving) return;
    if (pendingIdentity !== null) {
      setPendingIdentity(null);
      return;
    }
    if (hasFullUnsavedChanges) {
      void performSave();
      return;
    }
    setShowModal(false);
  };

  const SectionLabel = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 mb-4 px-1">
      <h3 className="text-[10px] font-black text-black uppercase tracking-[0.2em]">{title}</h3>
    </div>
  );
  const TimeInput = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold text-black/40 px-1 uppercase tracking-widest">{label}</p>
      <TimePicker value={value} onChange={onChange} />
    </div>
  );

  return (
    <>
      <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => setShowModal(true)}
        className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
      >
        <div className="flex items-start gap-2.5 text-left">
          <Clock3 size={16} strokeWidth={1.5} className="mt-0.5 text-[#5F7A63]" />
          <div>
            <p className="profile-fn-title">{t('profile_routine_title')}</p>
          </div>
        </div>
        <ChevronRight size={16} strokeWidth={1.5} className="text-slate-400" />
      </button>
      </div>

      {/* 弹窗 */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={requestCloseModal} className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="relative w-full sm:max-w-sm bg-white rounded-t-[28px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
              style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 8px)' }}
            >
              <style dangerouslySetInnerHTML={{ __html: `.cr-scroll::-webkit-scrollbar{width:4px}.cr-scroll::-webkit-scrollbar-thumb{background:#8fae9130;border-radius:20px}` }} />

              {/* 标题 */}
              <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-4 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-black tracking-tighter text-black uppercase">{t('profile_routine_title')}</h2>
                <button onClick={requestCloseModal} className="p-2 rounded-full hover:bg-black/5 transition-colors">
                  <X size={18} className="text-black" />
                </button>
              </div>

              {/* 滚动内容 */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-2 space-y-8 sm:space-y-10 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] sm:pb-6 cr-scroll">

                {/* 身份 */}
                <section className="relative z-10">
                  <SectionLabel title={t('profile_schedule_section_title')} />
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'none', label: t('profile_schedule_identity_free') },
                      { id: 'work', label: t('profile_schedule_identity_work') },
                      { id: 'class', label: t('profile_schedule_identity_class') },
                    ] as const).map((item) => {
                      const isCurrent = item.id === savedIdentity;
                      const isSelected = item.id === identity;
                      return (
                        <button key={item.id}
                          onClick={() => {
                            if (item.id === identity) return;
                            if (item.id !== savedIdentity) {
                              setPendingIdentity(item.id);
                            } else {
                              setIdentity(item.id);
                              setPendingIdentity(null);
                            }
                          }}
                          className={`relative flex flex-col items-center justify-center py-2.5 rounded-lg border text-xs font-medium transition-all ${isSelected ? 'font-bold' : 'border-transparent bg-white/60 text-[#426D56] hover:border-[#CBE7D7]'}`}
                          style={isSelected ? {
                            background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%) padding-box, linear-gradient(140deg, rgba(164,205,183,0.55) 0%, rgba(239,248,243,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
                            border: '0.5px solid transparent',
                            boxShadow: '0 6px 14px rgba(103,154,121,0.12)',
                            color: '#426D56',
                          } : undefined}>
                          {isCurrent && (
                            <span className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-[#8fae91]">
                              {t('profile_schedule_identity_current')}
                            </span>
                          )}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 身份切换确认条 */}
                  <AnimatePresence>
                    {pendingIdentity !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="mt-3 rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 space-y-2"
                      >
                        <p className="text-[11px] font-bold text-amber-800">{t('profile_schedule_identity_switch_title')}</p>
                        <p className="text-[11px] text-amber-700 leading-snug">
                          {t('profile_schedule_identity_switch_body', {
                            name: t(`profile_schedule_identity_${pendingIdentity}`),
                          })}
                        </p>
                        <div className="flex gap-2 pt-0.5">
                          <button
                            onClick={() => setPendingIdentity(null)}
                            className="flex-1 py-1.5 rounded-xl text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors">
                            {t('cancel')}
                          </button>
                          <button
                            onClick={() => { setIdentity(pendingIdentity); setPendingIdentity(null); }}
                            className="flex-1 py-1.5 rounded-xl text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors">
                            {t('confirm')}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* 基础作息 */}
                <section className="relative z-[9]">
                  <SectionLabel title={t('profile_routine_time_section')} />
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <TimeInput label={t('profile_user_profile_wake_time')} value={wakeTime} onChange={setWakeTime} />
                      <TimeInput label={t('profile_user_profile_breakfast')} value={breakfastTime} onChange={setBreakfastTime} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <TimeInput label={t('profile_user_profile_lunch')} value={lunchTime} onChange={setLunchTime} />
                      <TimeInput label={t('profile_user_profile_dinner')} value={dinnerTime} onChange={setDinnerTime} />
                    </div>
                    <TimeInput label={t('profile_user_profile_sleep_time')} value={sleepTime} onChange={setSleepTime} />
                  </div>
                </section>

                {/* 工作 / 课程 */}
                <AnimatePresence mode="wait">
                  {identity === 'work' && (
                    <motion.section key="work" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-[8]">
                      <SectionLabel title={t('profile_schedule_work_fields')} />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                        <TimeInput label={t('profile_user_profile_work_start')} value={workStart} onChange={setWorkStart} />
                        <TimeInput label={t('profile_user_profile_lunch_start')} value={workLunchStart} onChange={setWorkLunchStart} />
                        <TimeInput label={t('profile_user_profile_lunch_end')} value={workLunchEnd} onChange={setWorkLunchEnd} />
                        <TimeInput label={t('profile_user_profile_work_end')} value={workEnd} onChange={setWorkEnd} />
                      </div>
                    </motion.section>
                  )}
                  {identity === 'class' && (
                    <motion.section key="class" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-[8]">
                      <SectionLabel title={t('profile_schedule_class_fields')} />
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <TimeInput label={t('profile_user_profile_class_morning_start')} value={classMorningStart} onChange={setClassMorningStart} />
                          <TimeInput label={t('profile_user_profile_class_morning_end')} value={classMorningEnd} onChange={setClassMorningEnd} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <TimeInput label={t('profile_user_profile_class_afternoon_start')} value={classAfternoonStart} onChange={setClassAfternoonStart} />
                          <TimeInput label={t('profile_user_profile_class_afternoon_end')} value={classAfternoonEnd} onChange={setClassAfternoonEnd} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <TimeInput label={t('profile_user_profile_class_evening_start')} value={classEveningStart} onChange={setClassEveningStart} />
                          <TimeInput label={t('profile_user_profile_class_evening_end')} value={classEveningEnd} onChange={setClassEveningEnd} />
                        </div>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>

                {/* 提醒开关 */}
                <div className="border-t border-black/5 pt-5 space-y-2 relative z-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={13} className="text-[#8fae91]" />
                      <span className="text-[11px] font-black text-black uppercase tracking-[0.2em]">{t('profile_user_profile_reminder_enable')}</span>
                    </div>
                    <button onClick={() => setReminderEnabled(!reminderEnabled)}
                      className="w-9 h-5 rounded-full border border-transparent transition-colors relative"
                      style={reminderEnabled ? { background: 'linear-gradient(135deg, #C8EDD8 0%, #A5D4B8 100%)' } : { background: '#cbd5e1' }}>
                      <motion.div animate={{ x: reminderEnabled ? 16 : 2 }}
                        className="absolute left-0 w-4 h-4 rounded-full bg-white shadow-sm"
                        style={{ top: '50%', marginTop: '-8px' }} />
                    </button>
                  </div>
                  {Capacitor.isNativePlatform() && notifPermission !== null && notifPermission !== 'granted' && (
                    <button type="button" className="text-[11px] text-blue-500 underline"
                      onClick={() => { void requestNotificationPermission().then((granted) => { if (granted) setNotifPermission('granted'); }).catch(() => {}); }}>
                      去授权通知权限
                    </button>
                  )}
                  {todayCount !== null && (
                    <p className="text-[11px] text-black/30">⏰ {t('profile_user_profile_reminder_today_count')}：{todayCount} 条</p>
                  )}
                </div>
              </div>

              {/* 保存按钮 */}
              <div className="px-5 sm:px-8 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] sm:pb-8 pt-4 shrink-0">
                {saveText && <p className="mb-2 text-center text-[11px] text-slate-500">{saveText}</p>}
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => { void performSave(); }} disabled={saving}
                  className="w-full py-3 rounded-2xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: 'rgba(144, 212, 122, 0.20)', boxShadow: '0px 2px 2px #C8C8C8', color: '#5F7A63' }}>
                  {saving ? t('profile_routine_saving') : t('profile_routine_save')}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

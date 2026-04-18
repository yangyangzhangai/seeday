// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Clock3, X, ChevronDown, Bell } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
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
    return p as RoutineSnapshot;
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
function routineSig(v: RoutineSnapshot) { return JSON.stringify(v); }

// ─── TimePicker ───────────────────────────────────────────────
const TimePicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempHour, setTempHour] = React.useState(value.split(':')[0]);
  const [tempMinute, setTempMinute] = React.useState(value.split(':')[1]);
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const save = () => { onChange(`${tempHour}:${tempMinute}`); setIsOpen(false); };
  return (
    <div className={`relative transition-all duration-300 ${isOpen ? 'z-[60]' : 'z-0'}`}>
      <button onClick={() => setIsOpen(!isOpen)}
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
                <div className="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-16">
                  {hours.map((h) => (
                    <div key={h} onClick={(e) => { e.stopPropagation(); setTempHour(h); }}
                      className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-all ${tempHour === h ? 'text-black text-lg font-black' : 'text-black/20 text-sm'}`}>{h}</div>
                  ))}
                </div>
                <span className="text-lg font-black text-black">:</span>
                <div className="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-16">
                  {minutes.map((m) => (
                    <div key={m} onClick={(e) => { e.stopPropagation(); setTempMinute(m); }}
                      className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-all ${tempMinute === m ? 'text-black text-lg font-black' : 'text-black/20 text-sm'}`}>{m}</div>
                  ))}
                </div>
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
  const autoSaveTimerRef = React.useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const autoSaveReadyRef = React.useRef(false);

  const [identity, setIdentity] = React.useState<IdentityType>('none');
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
    [storageKey, userProfileV2?.manual?.updatedAt],
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
    setReminderEnabled(v2?.reminderEnabled ?? true);
  }, [userProfileV2]);

  React.useEffect(() => {
    const count = localStorage.getItem('reminder_today_count');
    if (count !== null) setTodayCount(Number(count));
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/local-notifications')
      .then(({ LocalNotifications }) => LocalNotifications.checkPermissions())
      .then((res) => setNotifPermission(res.display))
      .catch(() => {});
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

  const performSave = async (mode: 'manual' | 'auto') => {
    if (saving) return;
    if (!hasUnsavedChanges && mode === 'manual') { setSaveText(t('profile_routine_no_changes')); return; }
    if (!hasUnsavedChanges) return;
    if (mode === 'manual') setSaveText('');
    setSaving(true);
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
    setSaving(false);
    if (error) { if (mode === 'manual') setSaveText(t('profile_routine_save_failed')); return; }
    writeRoutineSnapshot(storageKey, { wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime });
    if (!reminderEnabled) localStorage.removeItem('reminder_scheduled_date');
    if (mode === 'manual') { setSaveText(t('profile_routine_saved')); setTimeout(() => setShowModal(false), 600); }
  };

  React.useEffect(() => {
    if (!autoSaveReadyRef.current) { if (!hasUnsavedChanges) autoSaveReadyRef.current = true; return; }
    if (!hasUnsavedChanges || saving) return;
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => { void performSave('auto'); }, 700);
    return () => { if (autoSaveTimerRef.current) { window.clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; } };
  }, [hasUnsavedChanges, saving, wakeTime, sleepTime, breakfastTime, lunchTime, dinnerTime, userProfileV2]);

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
      {/* 触发行 */}
      <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8]'}>
        <button onClick={() => setShowModal(true)}
          className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70">
          <div className="flex items-start gap-2.5 text-left">
            <Clock3 size={16} strokeWidth={1.5} className="mt-0.5 text-[#5F7A63]" />
            <div>
              <p className="profile-fn-title">{t('profile_routine_title')}</p>
              <p className="mt-0.5 text-[10px] font-light leading-tight text-slate-500">{t('profile_routine_desc')}</p>
            </div>
          </div>
          <ChevronRight size={16} strokeWidth={1.5} className="text-slate-400" />
        </button>
      </div>

      {/* 弹窗 */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col mx-4"
              style={{ maxHeight: '85vh' }}
            >
              <style dangerouslySetInnerHTML={{ __html: `.cr-scroll::-webkit-scrollbar{width:4px}.cr-scroll::-webkit-scrollbar-thumb{background:#8fae9130;border-radius:20px}` }} />

              {/* 标题 */}
              <div className="px-8 pt-8 pb-4 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-black tracking-tighter text-black uppercase">{t('profile_routine_title')}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-black/5 transition-colors">
                  <X size={18} className="text-black" />
                </button>
              </div>

              {/* 滚动内容 */}
              <div className="flex-1 overflow-y-auto px-8 py-2 space-y-10 pb-6 cr-scroll">

                {/* 身份 */}
                <section className="relative z-10">
                  <SectionLabel title={t('profile_schedule_section_title')} />
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: 'none', label: t('profile_schedule_identity_free') },
                      { id: 'work', label: t('profile_schedule_identity_work') },
                      { id: 'class', label: t('profile_schedule_identity_class') },
                    ] as const).map((item) => (
                      <button key={item.id} onClick={() => setIdentity(item.id)}
                        className={`flex items-center justify-center py-2 rounded-lg border text-xs font-medium transition-all ${identity === item.id ? 'font-bold' : 'border-transparent bg-white/60 text-[#426D56] hover:border-[#CBE7D7]'}`}
                        style={identity === item.id ? {
                          background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%) padding-box, linear-gradient(140deg, rgba(164,205,183,0.55) 0%, rgba(239,248,243,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
                          border: '0.5px solid transparent',
                          boxShadow: '0 6px 14px rgba(103,154,121,0.12)',
                          color: '#426D56',
                        } : undefined}>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
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
                      onClick={() => { import('@capacitor/local-notifications').then(({ LocalNotifications }) => { void LocalNotifications.requestPermissions(); }).catch(() => {}); }}>
                      去授权通知权限
                    </button>
                  )}
                  {todayCount !== null && (
                    <p className="text-[11px] text-black/30">⏰ {t('profile_user_profile_reminder_today_count')}：{todayCount} 条</p>
                  )}
                </div>
              </div>

              {/* 保存按钮 */}
              <div className="px-8 pb-8 pt-4 shrink-0">
                {saveText && <p className="mb-2 text-center text-[11px] text-slate-500">{saveText}</p>}
                <motion.button whileTap={{ scale: 0.98 }} onClick={() => { void performSave('manual'); }} disabled={saving}
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

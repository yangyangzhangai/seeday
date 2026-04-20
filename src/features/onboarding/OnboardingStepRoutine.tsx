// DOC-DEPS: LLM.md -> src/features/onboarding/OnboardingFlow.tsx -> src/features/profile/components/RoutineSettingsPanel.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  Clock,
  GraduationCap,
  LayoutGrid,
  MapPin,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type IdentityType = 'none' | 'work' | 'class';

export interface RoutineState {
  region: string;
  identity: IdentityType;
  remindMe: boolean;
  wakeTime: string;
  sleepTime: string;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  workStart: string;
  workEnd: string;
  classStart: string;
  classEnd: string;
}

interface Props {
  state: RoutineState;
  onChange: <K extends keyof RoutineState>(key: K, val: RoutineState[K]) => void;
  onNext: () => void;
  saving: boolean;
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempHour, setTempHour] = React.useState(value.split(':')[0]);
  const [tempMinute, setTempMinute] = React.useState(value.split(':')[1]);

  React.useEffect(() => {
    setTempHour(value.split(':')[0]);
    setTempMinute(value.split(':')[1]);
  }, [value]);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const save = () => {
    onChange(`${tempHour}:${tempMinute}`);
    setIsOpen(false);
  };

  return (
    <div className={`relative transition-all duration-300 ${isOpen ? 'z-[60]' : 'z-0'}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 border-2 ${
          isOpen
            ? 'bg-white border-[#4a5d4c] shadow-xl'
            : 'bg-white/60 border-transparent hover:border-[#4a5d4c]/10'
        } text-sm font-bold text-[#4a5d4c] group`}
      >
        <span className="flex items-center gap-2">
          <Clock size={14} className="opacity-30" /> {value}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown size={14} className="opacity-20 group-hover:opacity-100" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="absolute left-0 right-0 mt-2 rounded-[24px] bg-white border border-[#4a5d4c]/5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[50] overflow-hidden"
            >
              <div className="flex justify-center items-center h-40 relative px-6 gap-2 border-b border-zinc-50">
                <div className="absolute inset-x-8 h-10 border-y border-[#4a5d4c]/5 pointer-events-none" />
                <div className="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-16">
                  {hours.map((h) => (
                    <div
                      key={h}
                      onClick={() => setTempHour(h)}
                      className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-all ${
                        tempHour === h ? 'text-[#4a5d4c] text-lg font-black' : 'text-[#4a5d4c]/20 text-sm'
                      }`}
                    >
                      {h}
                    </div>
                  ))}
                </div>
                <span className="text-lg font-black text-[#4a5d4c]">:</span>
                <div className="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-16">
                  {minutes.map((m) => (
                    <div
                      key={m}
                      onClick={() => setTempMinute(m)}
                      className={`h-10 flex items-center justify-center snap-center cursor-pointer transition-all ${
                        tempMinute === m ? 'text-[#4a5d4c] text-lg font-black' : 'text-[#4a5d4c]/20 text-sm'
                      }`}
                    >
                      {m}
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-2 flex gap-2 bg-zinc-50/20">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2 rounded-xl text-[9px] font-bold text-[#4a5d4c]/40 uppercase tracking-[0.2em]"
                >
                  {t('onboarding_timepicker_cancel')}
                </button>
                <button
                  onClick={save}
                  className="flex-1 py-2 rounded-xl bg-[#4a5d4c] text-white text-[9px] font-bold uppercase tracking-[0.2em]"
                >
                  {t('onboarding_timepicker_confirm')}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export const OnboardingStepRoutine: React.FC<Props> = ({ state, onChange, onNext, saving }) => {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col px-8 pt-12 pb-8 overflow-y-auto no-scrollbar bg-[#f4f7f4]">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-[#4a5d4c] tracking-tight">{t('onboarding2_routine_title')}</h2>
        <p className="text-[#4a5d4c]/50 text-sm mt-2">{t('onboarding2_routine_desc')}</p>
      </div>

      <div className="space-y-8 pb-24">
        <section>
          <h3 className="text-[10px] font-black text-[#4a5d4c] uppercase tracking-[0.2em] mb-4 px-1">{t('onboarding2_routine_region')}</h3>
          <div className="bg-white/60 backdrop-blur-xl border border-white p-4 rounded-[24px] shadow-sm flex items-center gap-3 focus-within:border-[#8fae91] transition-all">
            <MapPin size={18} className="text-[#4a5d4c]/30 shrink-0" />
            <input
              value={state.region}
              onChange={(e) => onChange('region', e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold text-sm"
              placeholder={t('onboarding2_routine_region_placeholder')}
            />
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black text-[#4a5d4c] uppercase tracking-[0.2em] mb-4 px-1">{t('onboarding2_routine_identity_title')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'none' as const, label: t('profile_schedule_identity_free'), icon: LayoutGrid },
              { id: 'work' as const, label: t('profile_schedule_identity_work'), icon: Briefcase },
              { id: 'class' as const, label: t('profile_schedule_identity_class'), icon: GraduationCap },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => onChange('identity', item.id)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 transition-all ${
                  state.identity === item.id
                    ? 'border-[#4a5d4c] bg-[#4a5d4c] text-white shadow-lg'
                    : 'border-white bg-white/40 text-[#4a5d4c]/40'
                }`}
              >
                <span className="text-[11px] font-black">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black text-[#4a5d4c] uppercase tracking-[0.2em] mb-4 px-1">{t('onboarding2_routine_basic_title')}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_wake_time')}</p>
                <TimePicker value={state.wakeTime} onChange={(v) => onChange('wakeTime', v)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_breakfast')}</p>
                <TimePicker value={state.breakfastTime} onChange={(v) => onChange('breakfastTime', v)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_lunch')}</p>
                <TimePicker value={state.lunchTime} onChange={(v) => onChange('lunchTime', v)} />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_sleep_time')}</p>
                <TimePicker value={state.sleepTime} onChange={(v) => onChange('sleepTime', v)} />
              </div>
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {state.identity === 'work' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              key="work"
            >
              <h3 className="text-[10px] font-black text-[#4a5d4c] uppercase tracking-[0.2em] mb-4 px-1">{t('profile_schedule_work_fields')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_work_start')}</p>
                  <TimePicker value={state.workStart} onChange={(v) => onChange('workStart', v)} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_work_end')}</p>
                  <TimePicker value={state.workEnd} onChange={(v) => onChange('workEnd', v)} />
                </div>
              </div>
            </motion.section>
          )}

          {state.identity === 'class' && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              key="class"
            >
              <h3 className="text-[10px] font-black text-[#4a5d4c] uppercase tracking-[0.2em] mb-4 px-1">{t('profile_schedule_class_fields')}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_class_morning_start')}</p>
                  <TimePicker value={state.classStart} onChange={(v) => onChange('classStart', v)} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{t('profile_user_profile_class_evening_end')}</p>
                  <TimePicker value={state.classEnd} onChange={(v) => onChange('classEnd', v)} />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <div className="pt-6 border-t border-[#4a5d4c]/5 flex items-center justify-between">
          <span className="text-[11px] font-black text-[#4a5d4c] uppercase tracking-[0.2em]">{t('profile_user_profile_reminder_enable')}</span>
          <button
            onClick={() => onChange('remindMe', !state.remindMe)}
            className={`w-14 h-8 rounded-full transition-colors relative ${state.remindMe ? 'bg-[#4a5d4c]' : 'bg-white/40'}`}
          >
            <motion.div
              animate={{ x: state.remindMe ? 28 : 4 }}
              className={`absolute top-1.5 left-0 w-5 h-5 rounded-full shadow-sm ${state.remindMe ? 'bg-white' : 'bg-[#4a5d4c]/20'}`}
            />
          </button>
        </div>
      </div>

      <div className="mt-auto pt-6 bg-transparent">
        <button
          onClick={onNext}
          disabled={saving}
          className="w-full bg-[#4a5d4c] text-white py-5 rounded-[28px] font-bold text-lg shadow-xl shadow-[#4a5d4c]/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
        >
          {saving ? t('onboarding2_routine_saving') : t('onboarding2_routine_cta')} {!saving && <ChevronRight size={20} />}
        </button>
      </div>
    </div>
  );
};

// DOC-DEPS: LLM.md -> src/features/onboarding/OnboardingFlow.tsx -> src/features/profile/components/RoutineSettingsPanel.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingTimePicker } from './OnboardingTimePicker';

type IdentityType = 'none' | 'work' | 'class';

export interface RoutineState {
  region: string;
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
}

interface Props {
  state: RoutineState;
  onChange: <K extends keyof RoutineState>(key: K, val: RoutineState[K]) => void;
  onNext: () => void;
  saving: boolean;
}

const SectionLabel: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="text-[10px] font-black text-[#4a5d4c] uppercase tracking-[0.2em] mb-4">{title}</h3>
);

const TimeField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-1.5">
    <p className="text-[10px] font-bold text-[#4a5d4c]/40 px-1 uppercase tracking-widest">{label}</p>
    <OnboardingTimePicker value={value} onChange={onChange} />
  </div>
);

export const OnboardingStepRoutine: React.FC<Props> = ({ state, onChange, onNext, saving }) => {
  const { t } = useTranslation();
  const set = <K extends keyof RoutineState>(key: K) => (val: RoutineState[K]) => onChange(key, val);

  return (
    <div className="flex-1 flex flex-col px-8 pt-10 pb-8 overflow-y-auto no-scrollbar">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-[#4a5d4c] uppercase tracking-tighter">{t('onboarding_step4_title')}</h2>
      </div>

      <div className="space-y-8 pb-28">

        {/* 所在地区 */}
        <section>
          <SectionLabel title={t('onboarding2_routine_region')} />
          <div className="bg-white/60 backdrop-blur-xl border border-white p-4 rounded-[24px] flex items-center gap-3">
            <MapPin size={18} className="text-[#4a5d4c]/30 shrink-0" />
            <input
              value={state.region}
              onChange={(e) => onChange('region', e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-sm text-[#4a5d4c] placeholder:text-[#4a5d4c]/30 flex-1"
              placeholder="北京"
            />
          </div>
        </section>

        {/* 日程身份 */}
        <section className="relative z-10">
          <SectionLabel title={t('profile_schedule_section_title')} />
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'none' as const, label: t('profile_schedule_identity_free') },
              { id: 'work' as const, label: t('profile_schedule_identity_work') },
              { id: 'class' as const, label: t('profile_schedule_identity_class') },
            ]).map((item) => (
              <button
                key={item.id}
                onClick={() => onChange('identity', item.id)}
                className={`py-2.5 rounded-[16px] border text-xs font-bold transition-all ${
                  state.identity === item.id
                    ? 'bg-[#4a5d4c] text-white border-[#4a5d4c] shadow-lg shadow-[#4a5d4c]/20'
                    : 'bg-white/60 border-white text-[#4a5d4c]/60 hover:border-[#8fae91]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {/* 基础作息时间 */}
        <section className="relative z-[9]">
          <SectionLabel title={t('profile_routine_time_section')} />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <TimeField label={t('profile_user_profile_wake_time')} value={state.wakeTime} onChange={set('wakeTime')} />
              <TimeField label={t('profile_user_profile_breakfast')} value={state.breakfastTime} onChange={set('breakfastTime')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TimeField label={t('profile_user_profile_lunch')} value={state.lunchTime} onChange={set('lunchTime')} />
              <TimeField label={t('profile_user_profile_dinner')} value={state.dinnerTime} onChange={set('dinnerTime')} />
            </div>
            <TimeField label={t('profile_user_profile_sleep_time')} value={state.sleepTime} onChange={set('sleepTime')} />
          </div>
        </section>

        {/* 工作 / 课程 */}
        <AnimatePresence mode="wait">
          {state.identity === 'work' && (
            <motion.section key="work" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-[8]">
              <SectionLabel title={t('profile_schedule_work_fields')} />
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <TimeField label={t('profile_user_profile_work_start')} value={state.workStart} onChange={set('workStart')} />
                <TimeField label={t('profile_user_profile_lunch_start')} value={state.workLunchStart} onChange={set('workLunchStart')} />
                <TimeField label={t('profile_user_profile_lunch_end')} value={state.workLunchEnd} onChange={set('workLunchEnd')} />
                <TimeField label={t('profile_user_profile_work_end')} value={state.workEnd} onChange={set('workEnd')} />
              </div>
            </motion.section>
          )}
          {state.identity === 'class' && (
            <motion.section key="class" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-[8]">
              <SectionLabel title={t('profile_schedule_class_fields')} />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <TimeField label={t('profile_user_profile_class_morning_start')} value={state.classMorningStart} onChange={set('classMorningStart')} />
                  <TimeField label={t('profile_user_profile_class_morning_end')} value={state.classMorningEnd} onChange={set('classMorningEnd')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TimeField label={t('profile_user_profile_class_afternoon_start')} value={state.classAfternoonStart} onChange={set('classAfternoonStart')} />
                  <TimeField label={t('profile_user_profile_class_afternoon_end')} value={state.classAfternoonEnd} onChange={set('classAfternoonEnd')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TimeField label={t('profile_user_profile_class_evening_start')} value={state.classEveningStart} onChange={set('classEveningStart')} />
                  <TimeField label={t('profile_user_profile_class_evening_end')} value={state.classEveningEnd} onChange={set('classEveningEnd')} />
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* 底部按钮 */}
      <div className="fixed bottom-0 left-0 right-0 px-8 pb-10 pt-4 bg-gradient-to-t from-[#edf2ee] via-[#edf2ee]/90 to-transparent pointer-events-none">
        <button
          onClick={onNext}
          disabled={saving}
          className="w-full bg-[#4a5d4c] text-white py-5 rounded-[28px] font-bold text-lg shadow-xl shadow-[#4a5d4c]/20 flex items-center justify-center gap-2 disabled:opacity-60 pointer-events-auto"
        >
          {saving ? t('profile_routine_saving') : t('onboarding2_routine_cta')} {!saving && <ChevronRight size={20} />}
        </button>
      </div>
    </div>
  );
};

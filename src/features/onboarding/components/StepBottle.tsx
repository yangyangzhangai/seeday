// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/onboarding/OnboardingFlow.tsx -> src/store/useGrowthStore.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Check, ChevronRight, Droplets, Target, X } from 'lucide-react';
import type { BottleType } from '../../../store/useGrowthStore';

export type OnboardingBottleDraft = {
  id: string;
  name: string;
  type: BottleType;
};

type StepBottleProps = {
  onNext: (bottles: OnboardingBottleDraft[]) => void;
};

export function StepBottle({ onNext }: StepBottleProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<BottleType>('habit');
  const [bottles, setBottles] = React.useState<OnboardingBottleDraft[]>([]);

  const addBottle = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const duplicate = bottles.some((item) => item.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) return;
    setBottles((prev) => [{ id: Date.now().toString(), name: trimmed, type }, ...prev]);
    setName('');
    setType('habit');
  };

  const removeBottle = (id: string) => {
    setBottles((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col px-8 pt-16 pb-12 overflow-y-auto no-scrollbar bg-[#f4f7f4]">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-[#4a5d4c]">{t('growth_bottle_section')}</h2>
        <p className="text-[#4a5d4c]/50 text-sm mt-2">{t('growth_bottle_section_hint')}</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white border border-[#4a5d4c]/5 p-6 rounded-[32px] shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-[#4a5d4c]/50 uppercase tracking-widest">
              {t('growth_bottle_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addBottle()}
              placeholder={t('growth_bottle_name_placeholder')}
              className="w-full bg-[#4a5d4c]/5 border-none rounded-2xl px-4 py-3 text-sm font-bold text-[#4a5d4c] outline-none placeholder:text-[#4a5d4c]/25"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-[#4a5d4c]/50 uppercase tracking-widest">
              {t('growth_bottle_type')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('habit')}
                className={`rounded-2xl p-3 border text-sm font-bold flex items-center justify-center gap-2 ${
                  type === 'habit'
                    ? 'bg-[#8fae91]/15 text-[#4a5d4c] border-[#8fae91]/40'
                    : 'bg-[#4a5d4c]/5 text-[#4a5d4c]/50 border-transparent'
                }`}
              >
                <Droplets size={14} />
                {t('growth_bottle_type_habit')}
              </button>
              <button
                type="button"
                onClick={() => setType('goal')}
                className={`rounded-2xl p-3 border text-sm font-bold flex items-center justify-center gap-2 ${
                  type === 'goal'
                    ? 'bg-[#8fae91]/15 text-[#4a5d4c] border-[#8fae91]/40'
                    : 'bg-[#4a5d4c]/5 text-[#4a5d4c]/50 border-transparent'
                }`}
              >
                <Target size={14} />
                {t('growth_bottle_type_goal')}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={addBottle}
            disabled={!name.trim()}
            className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${
              name.trim()
                ? 'bg-[#4a5d4c] text-white shadow-lg shadow-[#4a5d4c]/20'
                : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/25'
            }`}
          >
            {t('growth_add_bottle')}
          </button>
        </div>

        {bottles.length > 0 && (
          <div className="space-y-3">
            {bottles.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/50 border border-white p-4 rounded-2xl flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#8fae91]/20 text-[#4a5d4c] flex items-center justify-center">
                    <Check size={14} strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#4a5d4c]">{item.name}</p>
                    <p className="text-[11px] text-[#4a5d4c]/45 font-semibold">
                      {item.type === 'habit' ? t('growth_bottle_type_habit') : t('growth_bottle_type_goal')}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => removeBottle(item.id)} className="p-2 text-[#4a5d4c]/25 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={() => onNext(bottles)}
          disabled={bottles.length === 0}
          className={`w-full py-5 rounded-[28px] font-bold text-lg shadow-xl flex items-center justify-center gap-2 transition-transform ${
            bottles.length > 0
              ? 'bg-[#4a5d4c] text-white shadow-[#4a5d4c]/20 active:scale-[0.98]'
              : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/25 shadow-none'
          }`}
        >
          {t('onboarding_next')} <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

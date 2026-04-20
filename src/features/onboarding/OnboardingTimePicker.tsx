// DOC-DEPS: LLM.md -> src/features/onboarding/OnboardingFlow.tsx -> src/features/onboarding/OnboardingStepRoutine.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const ITEM_H = 40;
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const DrumColumn: React.FC<{
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
}> = ({ items, selected, onSelect }) => {
  const ref = React.useRef<HTMLDivElement>(null);

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
    <div
      ref={ref}
      onScroll={handleScroll}
      className="flex-1 h-full overflow-y-auto no-scrollbar snap-y snap-mandatory py-16"
      style={{ overscrollBehavior: 'contain' }}
    >
      {items.map((item) => (
        <div
          key={item}
          className={`h-10 flex items-center justify-center snap-center transition-all duration-150 ${
            selected === item ? 'text-[#4a5d4c] text-lg font-black' : 'text-[#4a5d4c]/20 text-sm'
          }`}
        >
          {item}
        </div>
      ))}
    </div>
  );
};

export const OnboardingTimePicker: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempHour, setTempHour] = React.useState(value.split(':')[0] ?? '07');
  const [tempMinute, setTempMinute] = React.useState(value.split(':')[1] ?? '00');

  React.useEffect(() => {
    if (!isOpen) {
      setTempHour(value.split(':')[0] ?? '07');
      setTempMinute(value.split(':')[1] ?? '00');
    }
  }, [value, isOpen]);

  const save = () => { onChange(`${tempHour}:${tempMinute}`); setIsOpen(false); };
  const openPicker = () => {
    const [hour = '07', minute = '00'] = value.split(':');
    setTempHour(hour); setTempMinute(minute); setIsOpen(true);
  };

  return (
    <div className={`relative transition-all duration-300 ${isOpen ? 'z-[60]' : 'z-0'}`}>
      <button
        onClick={() => { if (isOpen) setIsOpen(false); else openPicker(); }}
        className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 border-2 ${
          isOpen
            ? 'bg-white border-[#4a5d4c] shadow-xl shadow-[#4a5d4c]/10'
            : 'bg-white/60 border-transparent hover:border-[#8fae91]/40'
        } text-sm font-bold text-[#4a5d4c] group relative z-[2]`}
      >
        <span>{value}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} className="text-[#4a5d4c]/30 group-hover:text-[#4a5d4c] transition-colors">
          <ChevronDown size={14} />
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
              className="absolute left-0 right-0 mt-2 rounded-[24px] bg-white border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.12)] z-[50] overflow-hidden"
            >
              <div className="flex justify-center items-center h-40 relative px-6 gap-2 border-b border-zinc-50">
                <div className="absolute inset-x-8 h-10 border-y border-[#4a5d4c]/10 pointer-events-none" />
                <DrumColumn items={HOURS} selected={tempHour} onSelect={setTempHour} />
                <span className="text-lg font-black text-[#4a5d4c]">:</span>
                <DrumColumn items={MINUTES} selected={tempMinute} onSelect={setTempMinute} />
              </div>
              <div className="p-2 flex gap-2 bg-zinc-50/20">
                <button onClick={() => setIsOpen(false)} className="flex-1 py-2 rounded-xl text-[9px] font-bold text-[#4a5d4c]/40 hover:text-[#4a5d4c] transition-colors uppercase tracking-[0.2em]">{t('onboarding_timepicker_cancel')}</button>
                <button onClick={save} className="flex-1 py-2 rounded-xl bg-[#4a5d4c] text-white text-[9px] font-bold shadow-sm uppercase tracking-[0.2em]">{t('onboarding_timepicker_confirm')}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar{display:none}` }} />
    </div>
  );
};

// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/chat/components/EventCard.tsx -> src/features/chat/components/MoodCard.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ArrowRightLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../../store/useChatStore';

type Phase = 'activity' | 'activity_shown' | 'mood' | 'complete';

// ── Lightweight preview cards matching real card visual styles ──

const PreviewEventCard: React.FC<{ text: string; highlight?: boolean }> = ({ text, highlight }) => (
  <div className="rounded-2xl" style={{ background: '#F7F9F8', padding: '10px 13px 9px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', margin: 0, flex: 1, minWidth: 0, paddingRight: 6 }}>
        {text}
      </h3>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        <div style={{
          width: 24, height: 24, background: '#0EA5E9', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: highlight ? '0 0 0 4px rgba(14,165,233,0.25)' : 'none',
          transition: 'box-shadow 0.3s',
        }}>
          <Camera size={10} color="#fff" />
        </div>
        <div style={{
          width: 24, height: 24, background: '#8B5CF6', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: highlight ? '0 0 0 4px rgba(139,92,246,0.25)' : 'none',
          transition: 'box-shadow 0.3s',
        }}>
          <ArrowRightLeft size={10} color="#fff" />
        </div>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#B2EEDA' }}>timer</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#B2EEDA' }}>{'< 1m'}</span>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: '#B2EEDA',
        animation: 'pulse 1s infinite', display: 'inline-block', marginLeft: 2,
      }} />
    </div>
  </div>
);

const PreviewMoodCard: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl" style={{
    background: 'linear-gradient(135deg, rgba(240,249,255,0.97) 0%, rgba(224,242,254,0.94) 100%)',
    padding: '10px 13px 9px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#38BDF8', flexShrink: 0 }} />
      <h3 style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', margin: 0 }}>{text}</h3>
    </div>
  </div>
);

// ── Shared input block ──

const InputBlock: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSend: () => void;
  autoFocus?: boolean;
}> = ({ value, onChange, placeholder, onSend, autoFocus }) => {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0;
  return (
    <div className="bg-white rounded-[24px] border border-[#4a5d4c]/5 shadow-sm overflow-hidden">
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={autoFocus}
        rows={3}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && canSend) { e.preventDefault(); onSend(); } }}
        className="w-full p-5 bg-transparent border-none outline-none resize-none text-[#4a5d4c] font-medium placeholder:text-[#4a5d4c]/25 text-base"
        placeholder={placeholder}
      />
      <div className="px-5 pb-4">
        <button
          onClick={onSend}
          disabled={!canSend}
          className={`w-full py-4 rounded-[20px] font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            canSend ? 'bg-[#4a5d4c] text-white' : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/20 cursor-not-allowed'
          }`}
        >
          <ChevronRight size={16} />
          {t('onboarding_j3_send')}
        </button>
      </div>
    </div>
  );
};

// ── Main component ──

export interface StepJournalProps { onNext: () => void; }

export const StepJournal: React.FC<StepJournalProps> = ({ onNext }) => {
  const { t } = useTranslation();
  const sendMessage = useChatStore(s => s.sendMessage);
  const sendMood    = useChatStore(s => s.sendMood);

  const [phase, setPhase]             = useState<Phase>('activity');
  const [activityText, setActivityText] = useState('');
  const [moodText, setMoodText]         = useState('');
  const [input, setInput]               = useState('');
  const [isSending, setIsSending]       = useState(false);

  const handleSendActivity = () => {
    const text = input.trim();
    if (!text) return;
    setActivityText(text);
    setInput('');
    setPhase('activity_shown');
  };

  const handleSendMood = () => {
    const text = input.trim();
    if (!text) return;
    setMoodText(text);
    setInput('');
    setPhase('complete');
  };

  const handleFinish = async () => {
    setIsSending(true);
    try {
      const actId = await sendMessage(activityText, undefined, { skipAnnotation: true });
      if (moodText) await sendMood(moodText, actId ? { relatedActivityId: actId } : undefined);
    } finally {
      setTimeout(() => onNext(), 200);
    }
  };

  const headerMap: Record<Phase, { title: string; desc: string }> = {
    activity:       { title: t('onboarding_j3_activity_title'), desc: t('onboarding_j3_activity_hint') },
    activity_shown: { title: `✨ ${t('onboarding_j3_shown_title')}`, desc: t('onboarding_j3_shown_desc') },
    mood:           { title: t('onboarding_j3_mood_title'), desc: t('onboarding_j3_mood_hint') },
    complete:       { title: t('onboarding_j3_complete_title'), desc: t('onboarding_j3_complete_desc') },
  };

  const { title, desc } = headerMap[phase];

  return (
    <div className="flex-1 flex flex-col px-6 pt-10 pb-10 bg-[#f8faf8]">

      {/* Header */}
      <div className="mb-6 px-1 shrink-0">
        <AnimatePresence mode="wait">
          <motion.div key={phase}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}>
            <h2 className="text-2xl font-black text-[#4a5d4c] tracking-tight">{title}</h2>
            <p className="text-[#4a5d4c]/55 text-sm mt-1 font-medium">{desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Card preview area */}
      <div className="flex flex-col gap-3 mb-5">
        <AnimatePresence>
          {(phase === 'activity_shown' || phase === 'mood' || phase === 'complete') && (
            <motion.div key="event-card"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
              <PreviewEventCard text={activityText} highlight={phase === 'activity_shown'} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature tooltips */}
        <AnimatePresence>
          {phase === 'activity_shown' && (
            <motion.div key="tooltips"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ delay: 0.15 }}
              className="flex flex-col gap-2 px-1 py-1">
              <div className="flex items-center gap-3">
                <div style={{ width: 28, height: 28, background: '#0EA5E9', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Camera size={12} color="#fff" />
                </div>
                <span className="text-sm text-[#4a5d4c]/70 font-medium">{t('onboarding_j3_tip_camera')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ width: 28, height: 28, background: '#8B5CF6', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowRightLeft size={12} color="#fff" />
                </div>
                <span className="text-sm text-[#4a5d4c]/70 font-medium">{t('onboarding_j3_tip_convert')}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'complete' && moodText && (
            <motion.div key="mood-card"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.1 }}>
              <PreviewMoodCard text={moodText} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input / CTA */}
      <div className="mt-auto">
        {phase === 'activity' && (
          <InputBlock
            value={input} onChange={setInput} autoFocus
            placeholder={t('onboarding_j3_activity_placeholder')}
            onSend={handleSendActivity}
          />
        )}

        {phase === 'activity_shown' && (
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            onClick={() => setPhase('mood')}
            className="w-full py-5 rounded-[28px] bg-[#4a5d4c] text-white font-bold text-base flex items-center justify-center gap-2 shadow-xl shadow-[#4a5d4c]/15">
            <ChevronRight size={18} />
            {t('onboarding_j3_tip_cta')}
          </motion.button>
        )}

        {phase === 'mood' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <InputBlock
              value={input} onChange={setInput}
              placeholder={t('onboarding_j3_mood_placeholder')}
              onSend={handleSendMood}
            />
            <button
              onClick={() => setPhase('complete')}
              className="w-full mt-3 py-3 text-xs text-[#4a5d4c]/35 font-bold uppercase tracking-widest">
              {t('onboarding_j3_mood_skip')}
            </button>
          </motion.div>
        )}

        {phase === 'complete' && (
          <motion.button
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => void handleFinish()}
            disabled={isSending}
            className="w-full py-5 rounded-[28px] bg-[#4a5d4c] text-white font-bold text-lg flex items-center justify-center gap-2 shadow-xl shadow-[#4a5d4c]/20">
            {isSending
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <><ChevronRight size={20} />{t('onboarding_j3_start_btn')}</>
            }
          </motion.button>
        )}
      </div>
    </div>
  );
};

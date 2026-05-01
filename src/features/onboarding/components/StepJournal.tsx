// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/chat/components/EventCard.tsx -> src/features/chat/components/MoodCard.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ArrowLeft, ArrowRightLeft, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '../../../store/useChatStore';
import { useMoodStore, type MoodOption } from '../../../store/useMoodStore';
import { autoDetectMood } from '../../../lib/mood';
import { getMoodColor } from '../../../lib/moodColor';
import { getMoodDisplayLabel } from '../../../lib/moodOptions';
import { EventCard } from '../../chat/components/EventCard';
import { MoodCard } from '../../chat/components/MoodCard';
import { MoodPickerModal } from '../../chat/MoodPickerModal';

type Phase = 'activity' | 'activity_shown' | 'mood' | 'complete';

const MOOD_TAG_FALLBACK_COLOR = '#0F766E';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hslToHex(h: number, s: number, l: number): string {
  const safeS = clamp01(s);
  const safeL = clamp01(l);
  const a = safeS * Math.min(safeL, 1 - safeL);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = safeL - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const cleaned = hex.replace('#', '');
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((ch) => `${ch}${ch}`).join('')
    : cleaned;
  if (normalized.length !== 6) return null;

  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function withHexAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  const normalized = cleaned.length === 3
    ? cleaned.split('').map((ch) => `${ch}${ch}`).join('')
    : cleaned;
  if (normalized.length !== 6) return hex;
  const alphaHex = Math.round(clamp01(alpha) * 255).toString(16).padStart(2, '0');
  return `#${normalized}${alphaHex}`;
}

function getStrongerMoodTagColor(hex: string | undefined): string {
  const parsed = hex ? hexToHsl(hex) : null;
  if (!parsed) return MOOD_TAG_FALLBACK_COLOR;
  const strongerS = Math.max(0.6, Math.min(1, parsed.s * 1.45));
  const strongerL = Math.max(0.25, Math.min(0.42, parsed.l - 0.24));
  return hslToHex(parsed.h, strongerS, strongerL);
}

// ── Shared input block ──

const InputBlock: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSend: () => void;
  autoFocus?: boolean;
  submitting?: boolean;
}> = ({ value, onChange, placeholder, onSend, autoFocus, submitting }) => {
  const { t } = useTranslation();
  const canSend = value.trim().length > 0 && !submitting;
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
  const endActivity = useChatStore(s => s.endActivity);
  const reattachMoodToEvent = useChatStore(s => s.reattachMoodToEvent);
  const convertMoodToEvent = useChatStore(s => s.convertMoodToEvent);
  const messages = useChatStore(s => s.messages);
  const setMood = useMoodStore(s => s.setMood);
  const setCustomMoodLabel = useMoodStore(s => s.setCustomMoodLabel);
  const setCustomMoodApplied = useMoodStore(s => s.setCustomMoodApplied);
  const activityMoodMap = useMoodStore(s => s.activityMood);
  const customMoodLabel = useMoodStore(s => s.customMoodLabel);
  const customMoodApplied = useMoodStore(s => s.customMoodApplied);

  const [phase, setPhase]             = useState<Phase>('activity');
  const [activityText, setActivityText] = useState('');
  const [activityMessageId, setActivityMessageId] = useState<string | null>(null);
  const [moodMessageId, setMoodMessageId] = useState<string | null>(null);
  const [moodText, setMoodText]         = useState('');
  const [input, setInput]               = useState('');
  const [isSending, setIsSending]       = useState(false);
  const [moodPickerFor, setMoodPickerFor] = useState<string | null>(null);
  const [selectedMoodOpt, setSelectedMoodOpt] = useState<string | null>(null);
  const [customLabelInput, setCustomLabelInput] = useState('');
  const [showCustomLabelInput, setShowCustomLabelInput] = useState(false);
  const prevActivityWasMoodRef = useRef(false);

  const activityMessage = activityMessageId
    ? messages.find((msg) => msg.id === activityMessageId)
    : undefined;
  const linkedMoodDescription = activityMessage?.moodDescriptions?.length
    ? [...activityMessage.moodDescriptions].sort((a, b) => b.timestamp - a.timestamp)[0]
    : undefined;
  const previewMoodId = moodMessageId || linkedMoodDescription?.id || null;
  const previewMoodMessage = previewMoodId
    ? messages.find((msg) => msg.id === previewMoodId)
    : undefined;
  const convertedToMoodCard = !!activityMessage?.isMood;
  const detachedMoodInPreview = !!previewMoodMessage?.detached;
  const previewMoodConvertedToEvent = !!previewMoodMessage && !previewMoodMessage.isMood;
  const linkedMoodInPreview = !!linkedMoodDescription && !detachedMoodInPreview;
  const mustRestoreBeforeNext = convertedToMoodCard || previewMoodConvertedToEvent;
  const customLabelDefault = t('chat_custom_label_default');
  const legacyCustomLabels = ['自定义', 'Custom', 'Personalizzato'];
  const moodPickerReadonly = false;
  const onboardingMoodRawLabel = activityMessage
    ? ((customMoodApplied[activityMessage.id] && customMoodLabel[activityMessage.id])
      ? customMoodLabel[activityMessage.id]
      : activityMoodMap[activityMessage.id])
    : undefined;
  const onboardingMoodFallback =
    !onboardingMoodRawLabel && activityMessage && activityMessage.mode === 'record' && !activityMessage.isMood && activityMessage.duration != null
      ? autoDetectMood(activityMessage.content, 0)
      : undefined;
  const onboardingMoodColor = getMoodColor(onboardingMoodRawLabel || onboardingMoodFallback) || '#10B981';
  const onboardingMoodTagColor = getStrongerMoodTagColor(onboardingMoodColor);
  const onboardingMoodTagBg = withHexAlpha(onboardingMoodTagColor, 0.2);
  const onboardingMoodTagLabel = getMoodDisplayLabel(onboardingMoodRawLabel || onboardingMoodFallback, t) || t('mood_calm');
  const isDefaultCustomLabel = (label: string) =>
    !label || label === customLabelDefault || legacyCustomLabels.includes(label);

  useEffect(() => {
    if (!activityMessageId) return;
    if (!activityMessage) {
      setActivityMessageId(null);
      setMoodMessageId(null);
      setActivityText('');
      setMoodText('');
      setInput('');
      setPhase('activity');
      prevActivityWasMoodRef.current = false;
      return;
    }
    const wasMood = prevActivityWasMoodRef.current;
    if (activityMessage.isMood && phase !== 'complete') {
      setMoodText((prev) => prev || activityMessage.content);
      setPhase('complete');
      prevActivityWasMoodRef.current = true;
      return;
    }

    if (wasMood && !activityMessage.isMood) {
      setMoodText('');
      setInput('');
      if (!linkedMoodDescription?.id) {
        setMoodMessageId(null);
        setPhase('mood');
      }
    }

    prevActivityWasMoodRef.current = activityMessage.isMood;
  }, [activityMessageId, activityMessage, phase, linkedMoodDescription]);

  useEffect(() => {
    if (moodMessageId && !previewMoodMessage) {
      setMoodMessageId(linkedMoodDescription?.id || null);
      setMoodText('');
      return;
    }

    if (!moodMessageId && linkedMoodDescription?.id) {
      setMoodMessageId(linkedMoodDescription.id);
    }
  }, [moodMessageId, previewMoodMessage, linkedMoodDescription]);

  const handleSendActivity = async () => {
    const text = input.trim();
    if (!text) return;
    setIsSending(true);
    try {
      const messageId = await sendMessage(text, undefined, { skipAnnotation: true });
      if (!messageId) return;
      setActivityText(text);
      setActivityMessageId(messageId);
      setMoodMessageId(null);
      setMoodText('');
      setInput('');
      setPhase('activity_shown');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMood = async () => {
    const text = input.trim();
    if (!text) return;
    setIsSending(true);
    try {
      const createdMoodId = await sendMood(text, activityMessageId ? { relatedActivityId: activityMessageId } : undefined);
      if (!createdMoodId) return;
      setMoodText(text);
      setMoodMessageId(createdMoodId);
      setInput('');
      setPhase('complete');
    } finally {
      setIsSending(false);
    }
  };

  const handleFinish = async () => {
    setIsSending(true);
    try {
      // no-op: onboarding state already committed in realtime
    } finally {
      setTimeout(() => onNext(), 200);
    }
  };

  const handleMoodClick = (msgId: string) => {
    setMoodPickerFor(msgId);
    const moodState = useMoodStore.getState();
    const isCustom = moodState.customMoodApplied[msgId];
    const current = moodState.activityMood[msgId] || null;
    setSelectedMoodOpt(isCustom ? '__custom__' : current);
    const label = moodState.customMoodLabel[msgId] || '';
    setCustomLabelInput(isCustom && label ? label : '');
    setShowCustomLabelInput(false);
  };

  const saveCustomLabel = (value: string) => {
    const next = value.trim();
    setCustomLabelInput(next);
    if (moodPickerFor) {
      if (!next) {
        setCustomMoodLabel(moodPickerFor, undefined);
        setCustomMoodApplied(moodPickerFor, false);
        const moodState = useMoodStore.getState();
        setSelectedMoodOpt(moodState.activityMood[moodPickerFor] || null);
      } else {
        setCustomMoodLabel(moodPickerFor, next);
        setCustomMoodApplied(moodPickerFor, !isDefaultCustomLabel(next));
        setSelectedMoodOpt('__custom__');
      }
    }
    setShowCustomLabelInput(false);
  };

  const handleBlockedDelete = () => {
    window.alert(t('onboarding_j3_delete_blocked'));
  };

  const headerMap: Record<Phase, { title: string; desc: string }> = {
    activity:       { title: t('onboarding_j3_activity_title'), desc: t('onboarding_j3_activity_hint') },
    activity_shown: { title: t('onboarding_j3_shown_title'), desc: t('onboarding_j3_shown_desc') },
    mood:           { title: t('onboarding_j3_mood_title'), desc: t('onboarding_j3_mood_hint') },
    complete:       {
      title: t('onboarding_j3_complete_title'),
      desc: convertedToMoodCard
        ? `${t('event_to_mood')} · ${t('mood_to_event')}`
        : t('onboarding_j3_complete_desc'),
    },
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
            <h2 className="text-2xl font-black text-[#4a5d4c] tracking-tight flex items-center gap-3">
              {phase === 'activity_shown' && <span className="text-3xl leading-none">🪄</span>}
              <span>{title}</span>
            </h2>
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
              {activityMessage?.isMood ? (
                <MoodCard
                  message={activityMessage}
                  onReturnToEvent={() => {}}
                  allowReturnToEvent={false}
                  onConvertToEvent={id => void convertMoodToEvent(id)}
                  alwaysShowActions
                  onDelete={() => handleBlockedDelete()}
                  onMoodClick={handleMoodClick}
                />
              ) : activityMessage ? (
                <EventCard
                  message={activityMessage}
                  moodDescriptions={activityMessage.moodDescriptions || []}
                  onEndActivity={id => void endActivity(id)}
                  onConvertMood={(id) => setMoodMessageId(id)}
                  onMoodClick={handleMoodClick}
                  onDelete={() => handleBlockedDelete()}
                  allowConvertToMood
                  alwaysShowActions
                />
              ) : (
                <div className="rounded-2xl" style={{ background: '#F7F9F8', padding: '10px 13px 9px' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
                    {activityText}
                  </h3>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'complete' && previewMoodMessage && (previewMoodMessage.detached || previewMoodConvertedToEvent) && (
            <motion.div key="detached-mood-card"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28, delay: 0.06 }}>
              {previewMoodConvertedToEvent ? (
                <EventCard
                  message={previewMoodMessage}
                  moodDescriptions={previewMoodMessage.moodDescriptions || []}
                  onEndActivity={id => void endActivity(id)}
                  onConvertMood={(id) => setMoodMessageId(id)}
                  onMoodClick={handleMoodClick}
                  onDelete={() => handleBlockedDelete()}
                  allowConvertToMood
                  alwaysShowActions
                />
              ) : (
                <MoodCard
                  message={previewMoodMessage}
                  onReturnToEvent={id => void reattachMoodToEvent(id)}
                  allowReturnToEvent
                  onConvertToEvent={id => void convertMoodToEvent(id)}
                  alwaysShowActions
                  onDelete={() => handleBlockedDelete()}
                  onMoodClick={handleMoodClick}
                />
              )}
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
                <div style={{ width: 28, height: 28, background: '#B2EEDA', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#4a5d4c' }}>timer</span>
                </div>
                <span className="text-sm text-[#4a5d4c]/70 font-medium">
                  {t('onboarding_j3_tip_duration_prefix', { duration: '< 1m' })}
                  <span className="inline-flex items-center rounded-full border border-[#F4C0C2]/60 bg-[#F4C0C2]/10 px-2 py-0.5 text-xs font-semibold text-[#F4C0C2] mx-1 align-middle">
                    <span className="material-symbols-outlined" style={{ fontSize: 12, lineHeight: 1 }}>stop_circle</span>
                  </span>
                  {t('onboarding_j3_tip_duration_suffix')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ width: 28, height: 28, background: '#0EA5E9', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Camera size={12} color="#fff" />
                </div>
                <span className="text-sm text-[#4a5d4c]/70 font-medium">{t('onboarding_j3_tip_camera_story')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ width: 28, height: 28, background: '#8B5CF6', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowRightLeft size={12} color="#fff" />
                </div>
                <span className="text-sm text-[#4a5d4c]/70 font-medium">{t('onboarding_j3_tip_convert_intent')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#4a5d4c]/70 font-medium">
                <span
                  className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs transition-colors"
                  style={{
                    fontWeight: 400,
                    background: onboardingMoodTagBg,
                    color: onboardingMoodTagColor,
                    border: '0.5px solid rgba(255,255,255,0.72)',
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    fontFamily: 'Songti SC, SimSun, STSong, serif',
                    letterSpacing: 0,
                    transition: 'all 0.15s',
                    boxShadow: 'none',
                  }}
                >
                  {onboardingMoodTagLabel}
                </span>
                <span>{t('onboarding_j3_tip_mood_tag')}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === 'complete' && (
            <motion.div key="mood-tips"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ delay: 0.1 }}
              className="flex flex-col gap-2 px-1 py-1">
              {convertedToMoodCard ? (
                <>
                  <div className="flex items-center gap-3 text-sm text-[#4a5d4c]/70 font-medium">
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(52,211,153,0.4)',
                      color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap size={12} />
                    </div>
                    <span>{t('onboarding_j3_tip_mood_to_event')}</span>
                  </div>
                </>
              ) : previewMoodConvertedToEvent ? (
                <>
                  <div className="flex items-center gap-3 text-sm text-[#4a5d4c]/70 font-medium">
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(139,92,246,0.4)',
                      color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowRightLeft size={12} />
                    </div>
                    <span>{t('onboarding_j3_tip_convert')}</span>
                  </div>
                </>
              ) : detachedMoodInPreview ? (
                <>
                  <div className="flex items-center gap-3 text-sm text-[#4a5d4c]/70 font-medium">
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(56,189,248,0.4)',
                      color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowLeft size={12} />
                    </div>
                    <span>{t('onboarding_j3_tip_mood_return')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[#4a5d4c]/70 font-medium">
                    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(52,211,153,0.4)',
                      color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap size={12} />
                    </div>
                    <span>{t('onboarding_j3_tip_mood_to_event')}</span>
                  </div>
                </>
              ) : linkedMoodInPreview ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-[#4a5d4c]/70 font-medium">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-[#E6F7F1] text-[#2F6F5B] text-xs font-semibold">
                      {t('chat_magic_pen_linked_mood_label')}
                    </span>
                    <span>{t('onboarding_j3_tip_mood_linked')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#4a5d4c]/70 font-medium">
                    <span>{t('onboarding_j3_tip_mood_detach_prefix')}</span>
                    <span className="inline-flex items-center justify-center text-[#38BDF8]" style={{ width: 16, height: 16 }}>
                      <ArrowRightLeft size={13} />
                    </span>
                    <span>{t('onboarding_j3_tip_mood_detach_suffix')}</span>
                  </div>
                </>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Input / CTA */}
      <div
        className="mt-auto transition-[padding] duration-200"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-height, 0px))' }}
      >
        {phase === 'activity' && (
          <InputBlock
            value={input} onChange={setInput} autoFocus
            placeholder={t('onboarding_j3_activity_placeholder')}
            onSend={handleSendActivity}
            submitting={isSending}
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
              submitting={isSending}
            />
            <button
              onClick={() => setPhase('complete')}
              className="w-full mt-3 py-3 text-xs text-[#4a5d4c]/35 font-bold uppercase tracking-widest">
              {t('onboarding_j3_mood_skip')}
            </button>
          </motion.div>
        )}

        {phase === 'complete' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {mustRestoreBeforeNext && (
              <div className="rounded-2xl border border-[#F4C0C2]/45 bg-[#F4C0C2]/10 px-4 py-3 text-sm font-medium text-[#4a5d4c]/75">
                {convertedToMoodCard
                  ? t('onboarding_j3_tip_switch_back_event_continue')
                  : t('onboarding_j3_tip_switch_back_mood_continue')}
              </div>
            )}
            <div className="flex items-start gap-3 bg-[#4a5d4c]/5 rounded-[20px] px-4 py-3">
              <span className="text-lg shrink-0 mt-0.5">🪄</span>
              <div>
                <p className="text-sm font-bold text-[#4a5d4c]">{t('onboarding_j3_magic_pen_teaser_title')}</p>
                <p className="text-xs text-[#4a5d4c]/55 mt-0.5 leading-relaxed">{t('onboarding_j3_magic_pen_teaser_desc')}</p>
              </div>
            </div>
            <button
              onClick={() => void handleFinish()}
              disabled={isSending || mustRestoreBeforeNext}
              className={`w-full py-5 rounded-[28px] font-bold text-lg flex items-center justify-center gap-2 shadow-xl transition-all ${
                isSending || mustRestoreBeforeNext
                  ? 'bg-[#4a5d4c]/25 text-white/70 shadow-[#4a5d4c]/10 cursor-not-allowed'
                  : 'bg-[#4a5d4c] text-white shadow-[#4a5d4c]/20'
              }`}>
              {isSending
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><ChevronRight size={20} />{t('onboarding_j3_start_btn')}</>
              }
            </button>
          </motion.div>
        )}

        {moodPickerFor && (
          <MoodPickerModal
            moodPickerFor={moodPickerFor}
            moodPickerReadonly={moodPickerReadonly}
            selectedMoodOpt={selectedMoodOpt}
            customLabelInput={customLabelInput}
            showCustomLabelInput={showCustomLabelInput}
            customMoodLabel={customMoodLabel}
            customMoodApplied={customMoodApplied}
            onClose={() => setMoodPickerFor(null)}
            onSelectMood={(msgId, opt) => {
              setMood(msgId, opt as MoodOption, 'manual');
              setCustomMoodApplied(msgId, false);
              setShowCustomLabelInput(false);
              setSelectedMoodOpt(opt);
            }}
            onCustomLabelClick={() => {
              if (!moodPickerFor) return;
              setShowCustomLabelInput(true);
              const existing = (customMoodApplied[moodPickerFor] && customMoodLabel[moodPickerFor])
                ? (customMoodLabel[moodPickerFor] || '')
                : '';
              setCustomLabelInput(existing);
              setSelectedMoodOpt('__custom__');
            }}
            onCustomLabelChange={(value) => {
              setCustomLabelInput(value);
              if (moodPickerFor) {
                const next = value.trim();
                setCustomMoodLabel(moodPickerFor, next || undefined);
                const applied = !!next && !isDefaultCustomLabel(next);
                setCustomMoodApplied(moodPickerFor, applied);
                setSelectedMoodOpt('__custom__');
              }
            }}
            onCustomLabelSave={saveCustomLabel}
          />
        )}
      </div>
    </div>
  );
};

// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/store/useReminderStore.ts
import React, { useRef } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { APP_MODAL_OVERLAY_CLASS } from '../lib/modalTheme';
import { AI_COMPANION_VISUALS } from '../constants/aiCompanionVisuals';
import { useAuthStore } from '../store/useAuthStore';
import { useReminderStore } from '../store/useReminderStore';
import { useChatStore } from '../store/useChatStore';
import { triggerLightHaptic } from '../lib/haptics';
import type { ReminderType } from '../services/reminder/reminderTypes';

interface Props {
  type: ReminderType;
  copyText: string;
  onConfirm: () => void;
  onDeny: () => void;
}

export const ReminderPopup: React.FC<Props> = ({ type, copyText, onConfirm, onDeny }) => {
  const { t } = useTranslation();
  const aiMode = useAuthStore((s) => s.preferences.aiMode);
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const markConfirmed = useReminderStore((s) => s.markConfirmed);

  const visual = AI_COMPANION_VISUALS[aiMode];

  const handleConfirm = () => {
    triggerLightHaptic();
    onConfirm();
  };

  const handleDeny = () => {
    triggerLightHaptic();
    onDeny();
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    triggerLightHaptic();
    void sendMessage(inputValue.trim());
    markConfirmed(type);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div
      className={APP_MODAL_OVERLAY_CLASS}
      onClick={handleDeny}
    >
      <div
        className="w-full max-w-xs mx-4 rounded-3xl bg-white p-5 shadow-xl"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* AI 头像 + 文案 */}
        <div className="flex items-start gap-3 mb-5">
          <img
            src={visual.avatar}
            alt={visual.name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
          <p className="text-sm leading-relaxed text-slate-700 pt-1">{copyText}</p>
        </div>

        {/* ✓ / ✗ 按钮 */}
        <div className="flex justify-center gap-8 mb-5">
          <button
            onClick={handleConfirm}
            aria-label={t('reminder_popup_confirm')}
            className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90"
            style={{ background: '#5F7A63' }}
          >
            <Check size={20} color="white" strokeWidth={2.5} />
          </button>
          <button
            onClick={handleDeny}
            aria-label={t('reminder_popup_deny')}
            className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 bg-slate-200"
          >
            <X size={20} color="#94A3B8" strokeWidth={2.5} />
          </button>
        </div>

        {/* 分割线 */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[10px] text-slate-400">{t('reminder_popup_or_tell_me')}</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* 快捷输入框 */}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('reminder_popup_input_placeholder')}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#CBE7D7]"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition disabled:opacity-40"
            style={{ background: '#5F7A63' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 晚间总结弹窗（evening_check）
// ─────────────────────────────────────────────

interface EveningCheckPopupProps {
  copyText: string;
  todayEventCount: number;
  onViewReport: () => void;
  onGrowPlant: () => void;
  onSnooze: () => void;
  onClose: () => void;
}

export const EveningCheckPopup: React.FC<EveningCheckPopupProps> = ({
  copyText,
  todayEventCount,
  onViewReport,
  onGrowPlant,
  onSnooze,
  onClose,
}) => {
  const { t } = useTranslation();
  const aiMode = useAuthStore((s) => s.preferences.aiMode);
  const visual = AI_COMPANION_VISUALS[aiMode];

  return (
    <div className={APP_MODAL_OVERLAY_CLASS} onClick={onClose}>
      <div
        className="w-full max-w-xs mx-4 rounded-3xl bg-white p-5 shadow-xl"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.14)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <img
            src={visual.avatar}
            alt={visual.name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
          <div>
            <p className="text-sm leading-relaxed text-slate-700">{copyText}</p>
            {todayEventCount > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {t('evening_check_event_count', { count: todayEventCount })}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onGrowPlant}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-white transition active:scale-95"
            style={{ background: '#5F7A63' }}
          >
            {t('evening_check_grow_plant')}
          </button>
          <button
            onClick={onViewReport}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-[#355643] border border-[#CBE7D7] bg-white transition active:scale-95"
          >
            {t('evening_check_view_report')}
          </button>
          <button
            onClick={onSnooze}
            className="w-full rounded-xl py-2 text-xs text-slate-400 transition"
          >
            {t('evening_check_snooze')}
          </button>
        </div>
      </div>
    </div>
  );
};

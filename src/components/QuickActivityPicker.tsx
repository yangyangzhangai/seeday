// DOC-DEPS: LLM.md -> docs/PROACTIVE_REMINDER_SPEC.md -> src/store/useReminderStore.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useReminderStore } from '../store/useReminderStore';
import { triggerLightHaptic } from '../lib/haptics';

const QUICK_OPTIONS = [
  { emoji: '🍽', key: 'quick_activity_meal' },
  { emoji: '😴', key: 'quick_activity_rest' },
  { emoji: '🎮', key: 'quick_activity_entertainment' },
  { emoji: '🏃', key: 'quick_activity_health' },
  { emoji: '💬', key: 'quick_activity_social' },
  { emoji: '✏️', key: 'quick_activity_other' },
] as const;

export const QuickActivityPicker: React.FC = () => {
  const { t } = useTranslation();
  const { showQuickPicker, pickerContext, hidePicker } = useReminderStore();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [customInput, setCustomInput] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (showQuickPicker) setCustomInput('');
  }, [showQuickPicker]);

  if (!showQuickPicker) return null;

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    triggerLightHaptic();
    void sendMessage(text.trim());
    hidePicker();
  };

  const handleQuickOption = (emoji: string, labelKey: string) => {
    const label = `${emoji} ${t(labelKey)}`;
    handleSend(label);
  };

  const handleCustomSend = () => {
    if (customInput.trim()) {
      handleSend(customInput);
    } else {
      inputRef.current?.focus();
    }
  };

  const activityLabel = pickerContext?.activityType
    ? `你结束${pickerContext.activityType}了，`
    : '';

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => { triggerLightHaptic(); hidePicker(); }}
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border border-white/60 bg-white px-5 pb-10 pt-5"
        style={{ boxShadow: '0 -8px 32px rgba(15,23,42,0.12)' }}
      >
        {/* 拖拽把手 */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

        <p className="mb-4 text-sm font-medium text-slate-700">
          {activityLabel}{t('quick_activity_picker_title')}
        </p>

        {/* 快捷按钮 */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {QUICK_OPTIONS.map(({ emoji, key }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleQuickOption(emoji, key)}
              className="flex flex-col items-center gap-1 rounded-2xl bg-[#F7F9F8] py-3 text-sm transition active:bg-[#E8F0EA]"
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-xs text-slate-600">{t(key)}</span>
            </button>
          ))}
        </div>

        {/* 自由输入 */}
        <div className="flex items-center gap-2 rounded-2xl border border-[#CBE7D7] bg-[#F7F9F8] px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCustomSend(); }}
            placeholder={t('quick_activity_input_placeholder')}
            className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            style={{ fontSize: 16 }}
          />
          <button
            type="button"
            onClick={handleCustomSend}
            className={`rounded-full p-1.5 transition ${customInput.trim() ? 'text-[#5F7A63]' : 'text-slate-300'}`}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
};

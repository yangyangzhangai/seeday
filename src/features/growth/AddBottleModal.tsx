import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { type BottleType } from '../../store/useGrowthStore';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_INPUT_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_SELECTED_GLOW_BG,
  APP_SELECTED_GLOW_BORDER,
  APP_SELECTED_GLOW_SHADOW,
} from '../../lib/modalTheme';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, type: BottleType) => void;
  error?: string;
}

export const AddBottleModal = ({ isOpen, onClose, onAdd, error }: Props) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<BottleType>('habit');
  const selectedGlowStyle = {
    background: APP_SELECTED_GLOW_BG,
    border: APP_SELECTED_GLOW_BORDER,
    boxShadow: APP_SELECTED_GLOW_SHADOW,
  };

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), type);
    // Note: onClose / reset are handled by the parent after checking for errors
  };

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4', APP_MODAL_OVERLAY_CLASS)}>
      <div className={cn(APP_MODAL_CARD_CLASS, 'animate-in zoom-in-95 fade-in w-[min(92vw,420px)] max-h-[86vh] overflow-y-auto rounded-3xl p-6')}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-800">{t('growth_add_bottle_modal_title')}</h3>
          <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}><X size={20} /></button>
        </div>

        <label className="block text-sm font-medium text-slate-600 mb-1">
          {t('growth_bottle_name')}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('growth_bottle_name_placeholder')}
          className={cn(
            APP_MODAL_INPUT_CLASS,
            'mb-1 w-full p-3 text-sm',
            error ? "border-red-400" : "border-gray-200"
          )}
        />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <label className="block text-sm font-medium text-slate-600 mb-2">
          {t('growth_bottle_type')}
        </label>
        <div className="flex gap-3 mb-6">
          {(['habit', 'goal'] as const).map((bt) => (
            <button
              key={bt}
              onClick={() => setType(bt)}
              className={cn(
                'flex-1 rounded-xl border py-2 text-sm font-medium transition-all',
                type === bt
                  ? 'text-[#1D4ED8]'
                  : 'border-white/80 bg-white/70 text-[#2F3E33]'
              )}
              style={type === bt ? selectedGlowStyle : undefined}
            >
              {bt === 'habit' ? t('growth_bottle_type_habit') : t('growth_bottle_type_goal')}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'w-full py-2.5 disabled:cursor-not-allowed disabled:opacity-40')}
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  );
};

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { type BottleType } from '../../store/useGrowthStore';
import { cn } from '../../lib/utils';

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

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), type);
    // Note: onClose / reset are handled by the parent after checking for errors
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="animate-slide-up w-full max-w-lg rounded-t-3xl border border-[#EBDCC2] bg-[#FFF9EE] p-6 pb-safe shadow-[0_20px_60px_rgba(71,52,24,0.24)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[#5E4120]">{t('growth_add_bottle_modal_title')}</h3>
          <button onClick={onClose} className="rounded-full bg-white/80 p-1 text-gray-500"><X size={20} /></button>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('growth_bottle_name')}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('growth_bottle_name_placeholder')}
          className={cn(
            "mb-1 w-full rounded-2xl border p-3 text-sm text-[#5E4120] outline-none focus:ring-2 focus:ring-[#D8B37A]",
            error ? "border-red-400" : "border-gray-200"
          )}
        />
        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('growth_bottle_type')}
        </label>
        <div className="flex gap-3 mb-6">
          {(['habit', 'goal'] as const).map((bt) => (
            <button
              key={bt}
              onClick={() => setType(bt)}
              className={cn(
                "flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                type === bt
                  ? "border-blue-500 bg-blue-50 text-blue-600"
                  : "border-gray-200 text-gray-500"
              )}
            >
              {bt === 'habit' ? t('growth_bottle_type_habit') : t('growth_bottle_type_goal')}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full rounded-2xl bg-[#A86B2B] py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  );
};

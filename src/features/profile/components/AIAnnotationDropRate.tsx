import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAuthStore, type AnnotationDropRate } from '../../../store/useAuthStore';

const DROP_RATES: { key: AnnotationDropRate; labelKey: string }[] = [
  { key: 'low', labelKey: 'profile_drop_low' },
  { key: 'medium', labelKey: 'profile_drop_medium' },
  { key: 'high', labelKey: 'profile_drop_high' },
];

interface Props {
  isPlus: boolean;
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export const AIAnnotationDropRate: React.FC<Props> = ({ isPlus }) => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const current = preferences.annotationDropRate;

  const handleClick = (key: AnnotationDropRate) => {
    if (key !== 'low' && !isPlus) {
      showToast(t('profile_plus_only'));
      return;
    }
    updatePreferences({ annotationDropRate: key });
  };

  return (
    <div className="rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] px-4 py-2.5 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap flex-shrink-0">
          {t('profile_annotation_drop')}
        </span>
        <div className="flex gap-1.5 flex-1">
          {DROP_RATES.map(({ key, labelKey }) => {
            const locked = key !== 'low' && !isPlus;
            const selected = current === key;
            return (
              <button
                key={key}
                onClick={() => handleClick(key)}
                className={`relative flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  selected
                    ? 'border-[#8FAF92] bg-[#B2EEDA]/30 text-[#3f5f35] font-bold'
                    : locked
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50'
                    : 'border-[#B2EEDA]/60 bg-white/75 text-[#5F7A63]'
                }`}
              >
                {t(labelKey)}
                {locked && (
                  <Lock size={9} className="absolute top-1 right-1 text-gray-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

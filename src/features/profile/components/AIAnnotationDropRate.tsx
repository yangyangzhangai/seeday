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
    <div className="bg-white rounded-2xl shadow-sm px-4 py-2.5">
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
                    ? 'border-blue-500 bg-blue-100 text-blue-700 font-bold'
                    : locked
                    ? 'border-gray-200 bg-gray-100 text-gray-400 opacity-50 cursor-not-allowed'
                    : 'border-blue-200 bg-blue-50 text-blue-600'
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

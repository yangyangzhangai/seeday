import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Lock } from 'lucide-react';
import { useAuthStore, type AnnotationDropRate } from '../../../store/useAuthStore';
import { triggerLightHaptic } from '../../../lib/haptics';

const DROP_RATES: { key: AnnotationDropRate; labelKey: string }[] = [
  { key: 'low', labelKey: 'profile_drop_low' },
  { key: 'medium', labelKey: 'profile_drop_medium' },
  { key: 'high', labelKey: 'profile_drop_high' },
];

interface Props {
  isPlus: boolean;
  plain?: boolean;
  embedded?: boolean;
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export const AIAnnotationDropRate: React.FC<Props> = ({ isPlus, plain = false, embedded = false }) => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const current = preferences.annotationDropRate;
  const aiModeEnabled = preferences.aiModeEnabled;
  const selectedRateStyle: React.CSSProperties = {
    background:
      'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%) padding-box, linear-gradient(140deg, rgba(164,205,183,0.55) 0%, rgba(239,248,243,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
    border: '0.5px solid transparent',
    boxShadow: '0 6px 14px rgba(103,154,121,0.12)',
    color: '#426D56',
  };

  const handleClick = (key: AnnotationDropRate) => {
    triggerLightHaptic();
    if (!aiModeEnabled) return;
    if (key !== 'low' && !isPlus) {
      showToast(t('profile_plus_only'));
      return;
    }
    void updatePreferences({ annotationDropRate: key });
  };

  const content = (
    <>
      <div className={embedded ? 'mb-2 flex items-center gap-2' : 'flex flex-shrink-0 items-center space-x-2.5 whitespace-nowrap'}>
        <Bell size={embedded ? 15 : 18} strokeWidth={2} className="text-[#6e8b72]" />
        <span className={embedded ? 'text-[12px] font-semibold text-[#6b7f70]' : 'profile-fn-title'}>
          {t('profile_annotation_drop')}
        </span>
      </div>
      <div className={`flex gap-1.5 flex-1 transition-opacity ${aiModeEnabled ? '' : 'opacity-45 pointer-events-none'}`}>
        {DROP_RATES.map(({ key, labelKey }) => {
          const locked = key !== 'low' && !isPlus;
          const selected = current === key;
          return (
            <button
              key={key}
              onClick={() => { void handleClick(key); }}
              className={`relative flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all ${
                selected
                  ? 'font-bold'
                  : locked
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50'
                  : 'border-transparent bg-white/60 text-[#426D56] hover:border-[#CBE7D7]'
              }`}
              style={selected ? selectedRateStyle : undefined}
            >
              {t(labelKey)}
              {locked && (
                <Lock size={9} strokeWidth={1.5} className="absolute right-1 top-1 text-gray-400" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div className={plain ? 'px-4 py-2.5' : 'rounded-2xl border border-white/65 bg-[#F7F9F8] px-4 py-2.5 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <div className="flex items-center gap-2">
        {content}
      </div>
    </div>
  );
};

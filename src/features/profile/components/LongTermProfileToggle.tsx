import React from 'react';
import { useTranslation } from 'react-i18next';
import { Brain } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { triggerLightHaptic } from '../../../lib/haptics';

interface Props {
  plain?: boolean;
}

export const LongTermProfileToggle: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const { longTermProfileEnabled, updateLongTermProfileEnabled } = useAuthStore();
  const [statusText, setStatusText] = React.useState('');

  React.useEffect(() => {
    setStatusText('');
  }, [longTermProfileEnabled]);

  const enabledSwitchStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #D8EEDE 0%, #B8DEC7 100%)',
    boxShadow: '0 5px 12px rgba(103,154,121,0.22), inset 0 1px 0 rgba(255,255,255,0.68)',
    border: 'none',
  };

  return (
    <div className={plain ? 'px-4 py-2.5' : 'rounded-2xl border border-white/65 bg-[#F7F9F8] px-4 py-2.5 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start space-x-2.5">
            <Brain size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-slate-800" />
            <div className="min-w-0">
              <p className="profile-fn-title">{t('profile_long_term_profile')}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            triggerLightHaptic();
            setStatusText('');
            void updateLongTermProfileEnabled(!longTermProfileEnabled)
              .then(({ error }) => {
                setStatusText(
                  error
                    ? t('profile_long_term_profile_save_failed')
                    : t('profile_long_term_profile_saved'),
                );
              });
          }}
          type="button"
          role="switch"
          aria-checked={longTermProfileEnabled}
          aria-label={t('profile_long_term_profile')}
          className={`relative inline-flex w-9 h-5 flex-shrink-0 items-center rounded-full border transition-colors ${
            longTermProfileEnabled ? 'border-transparent' : 'border-transparent bg-slate-300'
          }`}
          style={longTermProfileEnabled ? enabledSwitchStyle : undefined}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              longTermProfileEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {statusText ? <p className="mt-1.5 pl-6 text-xs text-slate-500">{statusText}</p> : null}
    </div>
  );
};

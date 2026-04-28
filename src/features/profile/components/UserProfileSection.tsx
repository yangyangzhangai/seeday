import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { triggerLightHaptic } from '../../../lib/haptics';

interface Props {
  plain?: boolean;
  locked?: boolean;
}

export const UserProfileSection: React.FC<Props> = ({ plain = false, locked = false }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => {
          triggerLightHaptic();
          if (locked) {
            window.alert(t('profile_plus_only'));
            return;
          }
          navigate('/profile/memory');
        }}
        className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
      >
        <div className="flex items-start gap-2.5 text-left">
          <Sparkles size={18} strokeWidth={2} className="mt-0.5 text-[#000000]" />
          <div>
            <p className="profile-fn-title">{t('profile_user_profile_title')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {locked ? <Lock size={10} strokeWidth={1.5} className="text-gray-400" /> : null}
          <ChevronRight size={18} strokeWidth={2.5} className="text-[#5F7A63]" />
        </div>
      </button>
    </div>
  );
};

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { UserProfilePanel } from './UserProfilePanel';

interface Props {
  plain?: boolean;
}

type ProfileTab = 'schedule' | 'personalization' | 'anniversaries';

export const UserProfileSection: React.FC<Props> = ({ plain = false }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<ProfileTab>('schedule');

  const tabBaseClass = 'min-h-8 rounded-full px-3 text-[11px] transition';

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
      >
        <div className="flex items-start gap-2.5 text-left">
          <Sparkles size={16} className="mt-0.5 text-[#5F7A63]" />
          <div>
            <p className="text-xs text-slate-700">{t('profile_user_profile_title')}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('profile_user_profile_desc')}</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {expanded ? (
        <div className="border-t border-slate-200/60 px-4 pb-4 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`${tabBaseClass} ${activeTab === 'schedule' ? 'bg-[#E3F0E7] text-[#355643]' : 'border border-[#CBE7D7] bg-white/85 text-slate-600'}`}
            >
              {t('profile_user_profile_tab_schedule')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('personalization')}
              className={`${tabBaseClass} ${activeTab === 'personalization' ? 'bg-[#E3F0E7] text-[#355643]' : 'border border-[#CBE7D7] bg-white/85 text-slate-600'}`}
            >
              {t('profile_user_profile_tab_personalization')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('anniversaries')}
              className={`${tabBaseClass} ${activeTab === 'anniversaries' ? 'bg-[#E3F0E7] text-[#355643]' : 'border border-[#CBE7D7] bg-white/85 text-slate-600'}`}
            >
              {t('profile_user_profile_tab_anniversaries')}
            </button>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/60 bg-white/55">
            <UserProfilePanel plain showHeader={false} activeTab={activeTab} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

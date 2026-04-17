import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Lock, Sparkles } from 'lucide-react';
import { UserProfilePanel } from './UserProfilePanel';

interface Props {
  plain?: boolean;
  locked?: boolean;
}

export const UserProfileSection: React.FC<Props> = ({ plain = false, locked = false }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(!locked);

  React.useEffect(() => {
    if (locked) {
      setExpanded(false);
    }
  }, [locked]);

  return (
    <div className={plain ? 'overflow-hidden' : 'overflow-hidden rounded-2xl border border-white/65 bg-[#F7F9F8] [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      <button
        onClick={() => {
          if (locked) return;
          setExpanded((prev) => !prev);
        }}
        disabled={locked}
        className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
      >
        <div className="flex items-start gap-2.5 text-left">
          <Sparkles size={16} strokeWidth={1.5} className="mt-0.5 text-[#5F7A63]" />
          <div>
            <p className="text-xs text-slate-700">{t('profile_user_profile_title')}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{t('profile_user_profile_desc')}</p>
          </div>
        </div>
        {locked ? (
          <Lock size={10} strokeWidth={1.5} className="text-gray-400" />
        ) : expanded ? (
          <ChevronUp size={16} strokeWidth={1.5} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} strokeWidth={1.5} className="text-slate-400" />
        )}
      </button>

      {expanded ? (
        <div className="border-t border-slate-200/60 px-4 pb-4 pt-3">
          <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white/55">
            <UserProfilePanel plain showHeader={false} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

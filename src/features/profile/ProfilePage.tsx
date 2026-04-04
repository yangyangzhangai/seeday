import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { UserInfoCard } from './components/UserInfoCard';
import { AIModeSection } from './components/AIModeSection';
import { AIAnnotationDropRate } from './components/AIAnnotationDropRate';
import { DailyGoalToggle } from './components/DailyGoalToggle';
import { MembershipCard } from './components/MembershipCard';
import { SettingsList } from './components/SettingsList';
import { LanguageSwitcher } from '../../components/layout/LanguageSwitcher';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading, isPlus } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  return (
    <div className="relative flex h-full items-center justify-center bg-transparent px-0 md:px-8">
      <div className="pointer-events-none fixed right-0 top-0 h-[280px] w-[280px] rounded-full bg-[#B2EEDA]/10 blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[120px] left-0 h-[200px] w-[200px] rounded-full bg-rose-200/20 blur-[70px]" />

      <div className="app-mobile-page-frame relative h-full w-full max-w-[430px] overflow-y-auto text-slate-900 [box-shadow:0_0_0_1px_rgba(0,0,0,0.06),0_24px_64px_rgba(0,0,0,0.1)] md:h-[calc(100%-24px)] md:max-w-[980px] md:rounded-[30px] md:border md:border-white/70 md:bg-[#fcfaf7]/85 md:[box-shadow:0_0_0_1px_rgba(255,255,255,0.45),0_24px_64px_rgba(15,23,42,0.12)]">
        <header
          className="app-mobile-page-header sticky top-0 z-10 px-4 pb-3 pt-11"
          style={{
            background: 'rgba(252,250,247,0.38)',
            backdropFilter: 'blur(14px) saturate(150%)',
            WebkitBackdropFilter: 'blur(14px) saturate(150%)',
          }}
        >
          <h1 className="text-xl font-extrabold text-[#1e293b]" style={{ letterSpacing: '-0.02em' }}>{t('nav_profile')}</h1>
        </header>

        <div className="space-y-3 px-3 py-3 pb-28">
          <UserInfoCard isPlus={isPlus} />
          <div className="overflow-hidden">
            <div>
              <AIModeSection isPlus={isPlus} plain />
            </div>
            <div>
              <AIAnnotationDropRate isPlus={isPlus} plain />
            </div>
            <div>
              <DailyGoalToggle plain />
            </div>
            {!isPlus ? (
              <div className="px-0 py-2">
                <MembershipCard isPlus={isPlus} />
              </div>
            ) : null}
            <div className="px-4 py-3 transition hover:bg-white/70">
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <Languages size={16} className="text-[#5F7A63]" />
                  <span className="text-xs text-slate-700">{t('language_switch')}</span>
                </div>
                <LanguageSwitcher variant="list" />
              </div>
            </div>
            <div>
              <SettingsList plain />
            </div>
          </div>
          <div className="h-2" />
        </div>
      </div>
    </div>
  );
};

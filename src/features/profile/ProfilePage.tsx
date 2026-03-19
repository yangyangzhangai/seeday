import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../api/supabase';
import { UserInfoCard } from './components/UserInfoCard';
import { AIModeSection } from './components/AIModeSection';
import { AIAnnotationDropRate } from './components/AIAnnotationDropRate';
import { DailyGoalToggle } from './components/DailyGoalToggle';
import { MembershipCard } from './components/MembershipCard';
import { SettingsList } from './components/SettingsList';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  // Start as true: currently all users are treated as plus (no flash on first render)
  const [isPlus, setIsPlus] = useState(true);

  // Redirect unauthenticated users — wait for auth to finish loading first
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // TODO: Re-enable membership gating once membership framework is ready.
  // isPlus starts true so the UI renders correctly on first paint with no flash.
  // When real gating is re-enabled: change useState(true) → useState(false)
  // and restore setIsPlus(data?.plan === 'plus') inside the effect below.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('memberships')
      .select('plan')
      .eq('user_id', user.id)
      .single()
      .then(() => {
        setIsPlus(true); // temporarily unlocked — restore: setIsPlus(data?.plan === 'plus')
      });
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="px-3 py-3 space-y-2">
        <UserInfoCard isPlus={isPlus} />
        <AIModeSection isPlus={isPlus} />
        <AIAnnotationDropRate isPlus={isPlus} />
        <DailyGoalToggle />
        <MembershipCard isPlus={isPlus} />
        <SettingsList />
        {/* Bottom padding for safe area */}
        <div className="h-4" />
      </div>
    </div>
  );
};

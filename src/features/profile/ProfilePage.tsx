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
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [isPlus, setIsPlus] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Query membership status
  useEffect(() => {
    if (!user) return;
    supabase
      .from('memberships')
      .select('plan')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setIsPlus(data?.plan === 'plus');
      });
  }, [user]);

  if (!user) return null;

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

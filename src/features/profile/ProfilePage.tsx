import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserInfoCard } from './components/UserInfoCard';
import { AIModeSection } from './components/AIModeSection';
import { AIAnnotationDropRate } from './components/AIAnnotationDropRate';
import { DailyGoalToggle } from './components/DailyGoalToggle';
import { MembershipCard } from './components/MembershipCard';
import { SettingsList } from './components/SettingsList';

export const ProfilePage: React.FC = () => {
  const { user, loading, isPlus } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

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
        <div className="h-4" />
      </div>
    </div>
  );
};

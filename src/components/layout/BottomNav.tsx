import React from 'react';
import { NavLink } from 'react-router-dom';
import { Clock, PieChart, Sprout } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export const BottomNav = () => {
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe">
      <div className="flex justify-around items-center h-16">
        <NavLink
          to="/chat"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1",
              isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
            )
          }
        >
          <Clock size={24} />
          <span className="text-xs font-medium">{t('nav_record')}</span>
        </NavLink>

        <NavLink
          to="/growth"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1",
              isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
            )
          }
        >
          <Sprout size={24} />
          <span className="text-xs font-medium">{t('nav_growth')}</span>
        </NavLink>

        <NavLink
          to="/report"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center w-full h-full space-y-1",
              isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
            )
          }
        >
          <PieChart size={24} />
          <span className="text-xs font-medium">{t('nav_report')}</span>
        </NavLink>
      </div>
    </nav>
  );
};

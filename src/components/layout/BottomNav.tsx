import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

export const BottomNav = () => {
  const navItems = [
    { to: '/chat', icon: 'chat_bubble' },
    { to: '/growth', icon: 'schedule' },
    { to: '/report', icon: 'menu_book' },
    { to: '/profile', icon: 'person' },
  ] as const;

  return (
    <nav className="pointer-events-none fixed bottom-0 left-1/2 z-40 w-full max-w-[960px] -translate-x-1/2 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
      <div className="pointer-events-auto rounded-full border border-white/60 bg-white/30 px-2 py-1.5 backdrop-blur-[20px] [box-shadow:0_0_12px_rgba(255,255,255,0.2),inset_0_1px_1px_rgba(255,255,255,0.55)]">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'h-[52px] w-[52px] rounded-full flex items-center justify-center transition-all duration-200',
                  isActive
                    ? 'scale-105 bg-white text-[#5F7A63] [box-shadow:inset_0_2px_8px_rgba(255,255,255,0.9),0_10px_22px_rgba(15,23,42,0.16),0_0_0_1px_rgba(255,255,255,0.9)]'
                    : 'text-[#94A3B8]'
                )
              }
            >
              <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
};

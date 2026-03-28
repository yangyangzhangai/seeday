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
    <nav
      className="pointer-events-none fixed bottom-0 left-1/2 z-40 w-full max-w-[960px] -translate-x-1/2 px-4"
      style={{ paddingBottom: 34 }}
    >
      <div
        className="pointer-events-auto flex h-16 items-center justify-around rounded-full border px-2"
        style={{
          background: 'rgba(255,255,255,0.30)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          borderColor: 'rgba(255,255,255,0.58)',
          boxShadow: '0 0 12px rgba(255,255,255,0.20), inset 0 1px 1px rgba(255,255,255,0.55)',
        }}
      >
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'h-[52px] w-[52px] rounded-full flex items-center justify-center transition-all duration-200',
                  isActive
                    ? 'scale-[1.08] bg-white text-[#5F7A63] [box-shadow:inset_0_2px_8px_rgba(255,255,255,0.9),0_10px_22px_rgba(15,23,42,0.16),0_0_0_1px_rgba(255,255,255,0.9)]'
                    : 'text-[#8FAF92]'
                )
              }
            >
              <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
            </NavLink>
          ))}
      </div>
    </nav>
  );
};

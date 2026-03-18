import React from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';

export const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md border-b border-gray-200 z-50 flex items-center justify-between px-4">
      <div className="font-bold text-lg text-blue-600">TimeShine</div>
      <LanguageSwitcher />
    </header>
  );
};

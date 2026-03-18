import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';

const AI_MODES = [
  { key: 'van', name: 'Van', sub: '情绪治愈', icon: '🌸', free: true },
  { key: 'agnes', name: 'Agnes', sub: '引领指导', icon: '⚡', free: true },
  { key: 'zep', name: 'Zep', sub: '生活真实', icon: '🌿', free: true },
  { key: 'spring_thunder', name: 'Thunder', sub: '秩序催化', icon: '🌙', free: false },
];

interface Props {
  isPlus: boolean;
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export const AIModeSection: React.FC<Props> = ({ isPlus }) => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const enabled = preferences.aiModeEnabled;

  const handleModeClick = (key: string, free: boolean) => {
    if (!free && !isPlus) {
      showToast(t('profile_plus_only'));
      return;
    }
    updatePreferences({ aiMode: key as any });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm px-4 py-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-semibold text-gray-800">{t('profile_ai_mode')}</span>
          <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-medium">
            {t('profile_free')}
          </span>
        </div>
        <button
          onClick={() => updatePreferences({ aiModeEnabled: !enabled })}
          className={`relative inline-flex w-9 h-5 items-center rounded-full transition-colors flex-shrink-0 ${
            enabled ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Mode cards — 4 in one row */}
      <div
        className={`grid grid-cols-4 gap-1.5 transition-opacity ${
          !enabled ? 'opacity-40 pointer-events-none' : ''
        }`}
      >
        {AI_MODES.map((mode) => {
          const locked = !mode.free && !isPlus;
          const selected = preferences.aiMode === mode.key;
          return (
            <button
              key={mode.key}
              onClick={() => handleModeClick(mode.key, mode.free)}
              className={`relative flex flex-col items-center py-2 px-1 rounded-xl border-2 transition-all ${
                selected
                  ? 'border-blue-500 bg-blue-50'
                  : locked
                  ? 'border-gray-200 bg-gray-50 opacity-60'
                  : 'border-gray-200 bg-gray-50 hover:border-blue-300'
              }`}
            >
              <span className="text-lg leading-none mb-1">{mode.icon}</span>
              <span className="text-[11px] font-semibold text-gray-800 leading-tight">{mode.name}</span>
              <span className="text-[9px] text-gray-400 mt-0.5 leading-tight text-center">{mode.sub}</span>
              {locked && (
                <Lock size={10} className="absolute top-1 right-1 text-gray-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  AI_COMPANION_ORDER,
  AI_COMPANION_VISUALS,
} from '../../../constants/aiCompanionVisuals';
import type { AiCompanionMode } from '../../../lib/aiCompanion';
import profileAgnesAvatar from '../../../assets/profile-ai-companions/agnes.png';
import profileMomoAvatar from '../../../assets/profile-ai-companions/momo.png';
import profileVanAvatar from '../../../assets/profile-ai-companions/van.png';
import profileZepAvatar from '../../../assets/profile-ai-companions/zep.png';
import {
  APP_SELECTED_GLOW_BG,
  APP_SELECTED_GLOW_BORDER,
  APP_SELECTED_GLOW_SHADOW,
  APP_SELECTED_GLOW_TEXT,
} from '../../../lib/modalTheme';

interface Props {
  isPlus: boolean;
}

const PROFILE_AI_AVATARS: Record<AiCompanionMode, string> = {
  van: profileVanAvatar,
  agnes: profileAgnesAvatar,
  zep: profileZepAvatar,
  spring_thunder: profileMomoAvatar,
};

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
  const [isUpdating, setIsUpdating] = React.useState(false);
  const selectedGlowStyle: React.CSSProperties = {
    background: APP_SELECTED_GLOW_BG,
    border: APP_SELECTED_GLOW_BORDER,
    boxShadow: APP_SELECTED_GLOW_SHADOW,
  };

  const handleModeClick = async (key: AiCompanionMode, free: boolean) => {
    if (isUpdating) return;
    if (!free && !isPlus) {
      showToast(t('profile_plus_only'));
      return;
    }
    setIsUpdating(true);
    try {
      await updatePreferences({ aiMode: key });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      await updatePreferences({ aiModeEnabled: !enabled });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-white/65 bg-[#F7F9F8] px-4 py-3 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-semibold text-gray-800">{t('profile_ai_mode')}</span>
          <span className="rounded-full border border-[#B2EEDA]/50 bg-[#B2EEDA]/25 px-1.5 py-0.5 text-[10px] font-semibold text-[#3f5f35]">
            {t('profile_free')}
          </span>
        </div>
        <button
          onClick={() => { void handleToggleEnabled(); }}
          disabled={isUpdating}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors ${
            enabled ? '' : 'border-transparent bg-slate-300'
          }`}
          style={enabled ? selectedGlowStyle : undefined}
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
          !enabled || isUpdating ? 'opacity-40 pointer-events-none' : ''
        }`}
      >
        {AI_COMPANION_ORDER.map((modeKey) => {
          const mode = AI_COMPANION_VISUALS[modeKey];
          const locked = !mode.free && !isPlus;
          const selected = preferences.aiMode === modeKey;
          return (
            <button
              key={modeKey}
              onClick={() => { void handleModeClick(modeKey, mode.free); }}
              className={`relative flex flex-col items-center py-2 px-1 rounded-xl border transition-all ${
                selected
                  ? ''
                  : locked
                  ? 'border-slate-200 bg-slate-100 opacity-60'
                  : 'border-white/80 bg-white/60 hover:border-[#93C5FD]/60'
               }`}
              style={selected ? selectedGlowStyle : undefined}
             >
              <img
                src={PROFILE_AI_AVATARS[modeKey] ?? mode.avatar}
                alt={`${mode.name} avatar`}
                className="mb-1 h-9 w-9 object-contain"
              />
              <span
                className="text-[11px] font-semibold leading-tight"
                style={{ color: selected ? APP_SELECTED_GLOW_TEXT : '#1e293b' }}
              >
                {mode.name}
              </span>
              <span
                className="mt-0.5 text-center text-[9px] leading-tight"
                style={{ color: selected ? 'rgba(29,78,216,0.82)' : '#64748b' }}
              >
                {mode.subtitle}
              </span>
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

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
import { triggerLightHaptic } from '../../../lib/haptics';

interface Props {
  isPlus: boolean;
  plain?: boolean;
}

const PROFILE_AI_AVATARS: Record<AiCompanionMode, string> = {
  van: profileVanAvatar,
  agnes: profileAgnesAvatar,
  zep: profileZepAvatar,
  momo: profileMomoAvatar,
};

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export const AIModeSection: React.FC<Props> = ({ isPlus, plain = false }) => {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useAuthStore();
  const enabled = preferences.aiModeEnabled;
  const selectedModeStyle: React.CSSProperties = {
    background:
      'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%) padding-box, linear-gradient(140deg, rgba(164,205,183,0.55) 0%, rgba(239,248,243,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
    border: '0.5px solid transparent',
    boxShadow: '0 6px 14px rgba(103,154,121,0.12)',
  };
  const enabledSwitchStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #D8EEDE 0%, #B8DEC7 100%)',
    boxShadow: '0 5px 12px rgba(103,154,121,0.22), inset 0 1px 0 rgba(255,255,255,0.68)',
    border: 'none',
  };

  const handleModeClick = (key: AiCompanionMode, free: boolean) => {
    triggerLightHaptic();
    if (!free && !isPlus) {
      showToast(t('profile_plus_only'));
      return;
    }
    void updatePreferences({ aiMode: key });
  };

  const handleToggleEnabled = () => {
    triggerLightHaptic();
    void updatePreferences({ aiModeEnabled: !enabled });
  };

  return (
    <div className={plain ? 'px-4 py-3' : 'rounded-2xl border border-white/65 bg-[#F7F9F8] px-4 py-3 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_8px_24px_rgba(148,163,184,0.12)]'}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-slate-700">{t('profile_ai_mode')}</span>
          <span className="rounded-full border border-[#B2EEDA]/50 bg-[#B2EEDA]/25 px-1.5 py-0.5 text-[10px] font-semibold text-[#3f5f35]">
            {t('profile_free')}
          </span>
        </div>
        <button
          onClick={() => { void handleToggleEnabled(); }}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors ${
            enabled ? 'border-transparent' : 'border-transparent bg-slate-300'
          }`}
          style={enabled ? enabledSwitchStyle : undefined}
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
                  : 'border-transparent bg-white/60 hover:border-[#CBE7D7]'
               }`}
              style={selected ? selectedModeStyle : undefined}
             >
              <img
                src={PROFILE_AI_AVATARS[modeKey] ?? mode.avatar}
                alt={`${mode.name} avatar`}
                className="mb-1 h-9 w-9 object-contain"
              />
              <span
                className="text-xs font-semibold leading-tight"
                style={{ color: selected ? '#426D56' : '#1e293b' }}
              >
                {mode.name}
              </span>
              <span
                className="mt-0.5 text-center text-[9px] leading-tight"
                style={{ color: selected ? '#6F9580' : '#64748b' }}
              >
                {mode.subtitle}
              </span>
              {locked && (
                <Lock size={10} strokeWidth={1.5} className="absolute top-1 right-1 text-gray-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

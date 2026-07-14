import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import {
  AI_COMPANION_ORDER,
  AI_COMPANION_VISUALS,
} from '../../../constants/aiCompanionVisuals';
import type { AiCompanionMode } from '../../../lib/aiCompanion';
import { AIAnnotationDropRate } from './AIAnnotationDropRate';
import profileAgnesAvatar from '../../../assets/profile-ai-companions/agnes.png';
import profileMomoAvatar from '../../../assets/profile-ai-companions/momo.png';
import profileVanAvatar from '../../../assets/profile-ai-companions/van.png';
import profileZepAvatar from '../../../assets/profile-ai-companions/zep.png';
import { triggerLightHaptic } from '../../../lib/haptics';
import {
  APP_GREEN_GLASS_TEXT,
  APP_PROFILE_JELLY_TOGGLE_ON_STYLE,
} from '../../../lib/modalTheme';

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

const PROFILE_AI_SELECTED_PREVIEW_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(135deg, rgba(236,248,229,0.95) 0%, rgba(220,238,190,0.90) 45%, rgba(208,230,161,0.72) 100%) padding-box, linear-gradient(140deg, rgba(208,230,161,0.52) 0%, rgba(238,246,221,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box',
  border: '0.5px solid transparent',
  borderRadius: 12,
  boxShadow: '0 6px 14px rgba(183,207,124,0.14)',
  color: APP_GREEN_GLASS_TEXT,
  transition: 'all 0.15s',
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
    <div className={plain ? 'px-4 py-3' : 'rounded-2xl border border-white/65 bg-[#F7F9F8] px-4 py-3 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_4px_12px_rgba(148,163,184,0.08)]'}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="profile-fn-title">{t('profile_ai_mode')}</span>
            <span className="rounded-full border border-[#B2EEDA]/50 bg-[#B2EEDA]/25 px-1.5 py-0.5 text-xs font-semibold text-[#3f5f35]">
              {t('profile_free')}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#6b7f70]">
            {t('profile_ai_mode_desc')}
          </p>
        </div>
        <button
          onClick={() => { void handleToggleEnabled(); }}
          className="relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full border border-transparent transition-colors"
          style={enabled ? APP_PROFILE_JELLY_TOGGLE_ON_STYLE : { background: '#cbd5e1' }}
          aria-pressed={enabled}
          aria-label={t('profile_ai_mode')}
        >
          <motion.div
            animate={{ x: enabled ? 16 : 2 }}
            className="absolute left-0 w-4 h-4 rounded-full bg-white shadow-sm"
            style={{ top: '50%', marginTop: '-8px' }}
          />
        </button>
      </div>

      {enabled && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 space-y-4"
        >
          <div>
            <p className="mb-2 text-[12px] font-semibold text-[#6b7f70]">
              {t('profile_ai_companion_select')}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {AI_COMPANION_ORDER.map((modeKey) => {
                const mode = AI_COMPANION_VISUALS[modeKey];
                const locked = !mode.free && !isPlus;
                const selected = preferences.aiMode === modeKey;
                return (
                  <button
                    key={modeKey}
                    onClick={() => { void handleModeClick(modeKey, mode.free); }}
                    className={`relative flex flex-1 flex-col items-center rounded-lg border px-1 py-1.5 text-xs font-medium transition-all ${
                      selected
                        ? 'font-bold'
                        : locked
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50'
                        : 'border-transparent bg-white/60 text-[#426D56] hover:border-[#CBE7D7]'
                     }`}
                    style={selected ? PROFILE_AI_SELECTED_PREVIEW_STYLE : undefined}
                   >
                    <img
                      src={PROFILE_AI_AVATARS[modeKey] ?? mode.avatar}
                      alt={`${mode.name} avatar`}
                      className="mb-1 h-9 w-9 object-contain"
                    />
                    <span
                      className="text-[14px] font-semibold leading-tight"
                      style={{ color: selected ? APP_GREEN_GLASS_TEXT : '#1e293b' }}
                    >
                      {mode.name}
                    </span>
                    {locked && (
                      <Lock size={10} strokeWidth={1.5} className="absolute right-1 top-1 text-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <AIAnnotationDropRate isPlus={isPlus} embedded />
        </motion.div>
      )}
    </div>
  );
};

// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/useAuthStore.ts -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermission } from '../../services/notifications/localNotificationService';
import { Apple, Chrome, Sparkles, Mail, ChevronRight, Crown, Check, TrendingUp, Brain, Zap, Rocket, Lock, Loader2, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { OnboardingStepRoutine, type RoutineState } from './OnboardingStepRoutine';
import {
  DEFAULT_WAKE_TIME, DEFAULT_SLEEP_TIME,
  DEFAULT_BREAKFAST, DEFAULT_LUNCH, DEFAULT_DINNER,
  toHour,
} from '../profile/components/userProfilePanelHelpers';
import type { UserProfileManualV2, ClassSchedule } from '../../types/userProfile';
import profileVanAvatar from '../../assets/profile-ai-companions/van.png';
import profileAgnesAvatar from '../../assets/profile-ai-companions/agnes.png';
import profileZepAvatar from '../../assets/profile-ai-companions/zep.png';
import profileMomoAvatar from '../../assets/profile-ai-companions/momo.png';
import { StepTodo, type OnboardingTodoDraft } from './components/StepTodo';
import { StepBottle, type OnboardingBottleDraft } from './components/StepBottle';
import {
  AI_COMPANION_ORDER,
  AI_COMPANION_VISUALS,
} from '../../constants/aiCompanionVisuals';
import type { AiCompanionMode } from '../../lib/aiCompanion';

const TOTAL_STEPS = 8;
const ONBOARDED_KEY = 'seeday_onboarded';

function toDueAtFromTime(time: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return undefined;
  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date.getTime();
}

function buildClassSchedule(start: string, end: string): ClassSchedule | undefined {
  if (!start || !end) return undefined;
  return {
    weekdays: [1, 2, 3, 4, 5],
    morning: { start, end },
  };
}

const ProgressBar: React.FC<{ step: number }> = ({ step }) => (
  <div className="flex gap-1.5 px-8 pt-safe pt-6 pb-2 shrink-0">
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < step ? 'bg-[#4a5d4c]' : 'bg-[#4a5d4c]/15'}`} />
    ))}
  </div>
);

const StepLanguage: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t, i18n } = useTranslation();
  const { updateLanguagePreference } = useAuthStore();
  const normalizedLang = (i18n.language || 'zh').split('-')[0];
  const [selectedLang, setSelectedLang] = React.useState<'zh' | 'en' | 'it'>(
    normalizedLang === 'en' || normalizedLang === 'it' ? normalizedLang : 'zh',
  );

  const options: Array<{ code: 'zh' | 'en' | 'it'; label: string }> = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' },
    { code: 'it', label: 'Italiano' },
  ];

  const handleNext = async () => {
    await updateLanguagePreference(selectedLang);
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col px-8 pt-16 pb-12 bg-[#f4f7f4]">
      <div className="mb-10 text-center">
        <h2 className="text-2xl font-black text-[#4a5d4c] tracking-tight">{t('onboarding2_language_title')}</h2>
        <p className="text-[#4a5d4c]/55 text-sm mt-2">{t('onboarding2_language_desc')}</p>
      </div>

      <div className="space-y-3">
        {options.map((option) => {
          const selected = selectedLang === option.code;
          return (
            <button
              key={option.code}
              type="button"
              onClick={() => setSelectedLang(option.code)}
              className={`w-full p-5 rounded-[24px] border text-left font-bold transition-all ${
                selected
                  ? 'bg-[#4a5d4c] border-[#4a5d4c] text-white shadow-xl shadow-[#4a5d4c]/20'
                  : 'bg-white/60 border-white text-[#4a5d4c]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => { void handleNext(); }}
        className="mt-auto pt-6 w-full bg-[#4a5d4c] text-white py-5 rounded-[28px] font-bold text-lg shadow-xl shadow-[#4a5d4c]/20"
      >
        {t('onboarding_next')}
      </button>
    </div>
  );
};

// ── StepAuth ──────────────────────────────────────────────────
const StepAuth: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithApple, signInWithGoogle } = useAuthStore();
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [isLogin, setIsLogin] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const isValidPhone = (v: string) => /^1[3-9]\d{9}$/.test(v.trim());
  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const toPhoneAliasEmail = (v: string) => `${v.trim()}@phone.local`;

  const getErrorMessage = (msg: string) => {
    if (msg.includes('email rate limit exceeded')) return t('auth_error_rate_limit');
    if (msg.includes('Invalid login credentials')) return t('auth_error_invalid_credentials');
    if (msg.includes('User already registered')) return t('auth_error_user_exists');
    if (msg.includes('Password should be at least')) return t('auth_error_password_short');
    if (msg.includes('invalid_grant')) return t('auth_error_invalid_grant');
    return t('auth_error_generic') + msg;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const acc = identifier.trim();
      if (!isValidPhone(acc) && !isValidEmail(acc)) throw new Error(t('auth_error_invalid_account'));
      const emailToUse = isValidPhone(acc) ? toPhoneAliasEmail(acc) : acc;
      if (isLogin) {
        const { error: err } = await signIn(emailToUse, password);
        if (err) throw err;
        onNext();
      } else {
        const { error: err } = await signUp(emailToUse, password, nickname || undefined);
        if (err) throw err;
        setMessage(t('auth_register_success'));
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(getErrorMessage(err.message || t('auth_error_generic')));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError(null);
    const { error: err } = await signInWithApple();
    if (err) {
      setError(getErrorMessage(err.message || t('auth_error_generic')));
      setAppleLoading(false);
    } else {
      onNext();
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(getErrorMessage(err.message || t('auth_error_generic')));
      setGoogleLoading(false);
    }
  };

  const canSubmit = identifier.trim() && password.length >= 6 && !loading;

  return (
    <div className="flex-1 flex flex-col px-8 pt-16 pb-12 bg-[#f4f7f4]">
      <div className="mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="w-16 h-16 bg-[#8fae91]/20 rounded-[24px] flex items-center justify-center mb-6 shadow-inner"
        >
          <Sparkles className="text-[#4a5d4c]" size={32} />
        </motion.div>

        <h2 className="text-3xl font-black text-[#4a5d4c] leading-tight tracking-tight">
          {isLogin ? t('auth_welcome_back') : t('auth_create_account')}
        </h2>

        <p className="text-[#4a5d4c]/60 mt-4 text-sm leading-relaxed">
          {isLogin ? t('auth_login_subtitle') : t('auth_register_subtitle')}
        </p>
      </div>

      <div className="space-y-3">
        {/* 账号输入 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white p-5 rounded-[24px] shadow-sm flex items-center gap-3 group focus-within:border-[#8fae91] focus-within:bg-white transition-all">
          <div className="text-[#4a5d4c]/30 group-focus-within:text-[#4a5d4c] transition-colors">
            <Mail size={20} />
          </div>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t('onboarding2_auth_account_placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm"
          />
        </div>

        {/* 昵称（仅注册） */}
        {!isLogin && (
          <div className="bg-white/60 backdrop-blur-xl border border-white p-5 rounded-[24px] shadow-sm flex items-center gap-3 group focus-within:border-[#8fae91] focus-within:bg-white transition-all">
            <div className="text-[#4a5d4c]/30 group-focus-within:text-[#4a5d4c] transition-colors">
              <User size={20} />
            </div>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('auth_nickname_placeholder')}
              className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm"
            />
          </div>
        )}

        {/* 密码 */}
        <div className="bg-white/60 backdrop-blur-xl border border-white p-5 rounded-[24px] shadow-sm flex items-center gap-3 group focus-within:border-[#8fae91] focus-within:bg-white transition-all">
          <div className="text-[#4a5d4c]/30 group-focus-within:text-[#4a5d4c] transition-colors">
            <Lock size={20} />
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
            placeholder={t('onboarding2_auth_password_placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm"
          />
        </div>

        {/* 错误 / 成功提示 */}
        {error && <p className="text-red-500 text-xs px-2">{error}</p>}
        {message && <p className="text-[#4a5d4c] text-xs px-2">{message}</p>}

        {/* 切换登录/注册 */}
        <p className="text-center text-xs text-[#4a5d4c]/40 pt-1">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }}
            className="text-[#4a5d4c] font-bold underline decoration-[#4a5d4c]/20 ml-1"
          >
            {isLogin ? t('auth_switch_to_register') : t('auth_switch_to_login')}
          </button>
        </p>

        <div className="flex items-center gap-4 py-1">
          <div className="flex-1 h-[1px] bg-[#4a5d4c]/5" />
          <span className="text-[10px] font-bold text-[#4a5d4c]/20 uppercase tracking-[0.2em]">{t('auth_or_divider')}</span>
          <div className="flex-1 h-[1px] bg-[#4a5d4c]/5" />
        </div>

        <div className="flex gap-4">
          <AuthButton
            icon={appleLoading ? <Loader2 size={20} className="animate-spin" /> : <Apple size={20} fill="currentColor" />}
            text="Apple"
            className="flex-1"
            onClick={handleAppleSignIn}
            disabled={appleLoading || googleLoading}
          />
          <AuthButton
            icon={googleLoading ? <Loader2 size={20} className="animate-spin" /> : <Chrome size={20} />}
            text="Google"
            className="flex-1"
            onClick={handleGoogleSignIn}
            disabled={appleLoading || googleLoading}
          />
        </div>
      </div>

      <div className="mt-auto pt-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-5 rounded-[28px] font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
            canSubmit
              ? 'bg-[#4a5d4c] text-white shadow-[#4a5d4c]/20 hover:bg-[#3d4d3f]'
              : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/20 shadow-none cursor-not-allowed'
          }`}>
          {loading
            ? <Loader2 size={20} className="animate-spin" />
            : <>{isLogin ? t('auth_login_button') : t('auth_register_button')} <ChevronRight size={20} /></>
          }
        </motion.button>

        <p className="mt-6 text-center text-[10px] text-[#4a5d4c]/30 font-bold uppercase tracking-[0.1em]">
          {t('onboarding2_auth_agreement')}
        </p>
      </div>
    </div>
  );
};

function AuthButton({ icon, text, className = '', onClick, disabled = false }: {
  icon: React.ReactNode;
  text: string;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`bg-white/60 backdrop-blur-xl border border-white p-5 rounded-[24px] flex items-center justify-center gap-3 text-[#4a5d4c] font-bold shadow-sm transition-all hover:bg-white hover:shadow-md disabled:opacity-50 ${className}`}
    >
      {icon} <span className="text-sm">{text}</span>
    </motion.button>
  );
}

// ── StepAI ────────────────────────────────────────────────────
const StepAI: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const { updatePreferences } = useAuthStore();
  const [selectedMode, setSelectedMode] = React.useState<AiCompanionMode>('van');

  const onboardingAvatars: Record<AiCompanionMode, string> = {
    van: profileVanAvatar,
    agnes: profileAgnesAvatar,
    zep: profileZepAvatar,
    momo: profileMomoAvatar,
  };

  const subtitleKeyMap: Record<AiCompanionMode, string> = {
    van: 'profile_ai_mode_van_subtitle',
    agnes: 'profile_ai_mode_agnes_subtitle',
    zep: 'profile_ai_mode_zep_subtitle',
    momo: 'profile_ai_mode_momo_subtitle',
  };

  const handleSelect = () => {
    void updatePreferences({ aiMode: selectedMode, aiModeEnabled: true });
    onNext();
  };

  return (
    <div className="flex-1 flex flex-col px-8 pt-10 pb-12">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-black text-[#4a5d4c]">{t('onboarding2_ai_title')}</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {AI_COMPANION_ORDER.map((modeKey) => {
          const mode = AI_COMPANION_VISUALS[modeKey];
          const selected = selectedMode === modeKey;
          const badgeKey = mode.free ? 'onboarding2_ai_van_badge' : 'onboarding2_ai_agnes_badge';
          return (
            <button
              key={modeKey}
              type="button"
              onClick={() => setSelectedMode(modeKey)}
              className={`p-5 rounded-[28px] border text-left transition-all ${
                selected
                  ? 'bg-[#4a5d4c] border-[#4a5d4c] shadow-2xl'
                  : 'bg-white/60 backdrop-blur-xl border-white hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-12 h-12 rounded-[16px] overflow-hidden ${selected ? 'bg-white/10' : 'bg-[#4a5d4c]/5'}`}>
                  <img
                    src={onboardingAvatars[modeKey]}
                    className={`w-full h-full object-cover ${selected ? 'opacity-80' : 'opacity-70'}`}
                    alt={mode.name}
                  />
                </div>
                <span
                  className={`text-[10px] px-2.5 py-1 rounded-full font-black ${
                    selected
                      ? 'bg-[#8fae91] text-white'
                      : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/60'
                  }`}
                >
                  {t(badgeKey)}
                </span>
              </div>
              <div className="mt-4">
                <h4 className={`text-lg font-black ${selected ? 'text-white' : 'text-[#4a5d4c]'}`}>
                  {mode.name}
                </h4>
                <p className={`text-xs mt-1 leading-relaxed ${selected ? 'text-white/70' : 'text-[#4a5d4c]/55'}`}>
                  {t(subtitleKeyMap[modeKey])}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={handleSelect} className="mt-auto pt-6 w-full bg-[#4a5d4c] text-white py-5 rounded-[28px] font-bold text-lg shadow-xl shadow-[#4a5d4c]/20">
        {t('onboarding2_ai_cta')}
      </button>
    </div>
  );
};

// ── StepJournal ───────────────────────────────────────────────
const StepJournal: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const sendMessage = useChatStore((state) => state.sendMessage);
  const sendMood = useChatStore((state) => state.sendMood);
  const [content, setContent] = React.useState('');
  const [moodContent, setMoodContent] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const canSend = Boolean(content.trim() || moodContent.trim());

  const handleSend = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      const activityMessageId = content.trim()
        ? await sendMessage(content.trim(), undefined, { skipAnnotation: true })
        : null;
      if (moodContent.trim()) {
        await sendMood(moodContent.trim(), activityMessageId ? { relatedActivityId: activityMessageId } : undefined);
      }
    } finally {
      setTimeout(() => {
        onNext();
      }, 300);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-6 pt-12 pb-10 bg-[#f8faf8]">
      <div className="mb-8 px-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-black text-[#4a5d4c] tracking-tight"
        >
          {t('onboarding2_journal_title')}
        </motion.h2>
        <p className="text-[#4a5d4c]/55 text-sm mt-2 font-medium">
          {t('onboarding2_journal_desc')}
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="relative flex-1 bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#4a5d4c]/5 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-[#4a5d4c]/5 flex items-center justify-between bg-zinc-50/50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#8fae91] animate-pulse" />
              <span className="text-[10px] font-black text-[#4a5d4c]/30 uppercase tracking-widest">{t('onboarding2_journal_sync_badge')}</span>
            </div>
            <div className="text-[10px] font-bold text-[#4a5d4c]/30 uppercase tracking-widest">
              {new Date().getHours()}:{new Date().getMinutes().toString().padStart(2, '0')}
            </div>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoFocus
            className="flex-1 p-6 bg-transparent border-none outline-none resize-none text-[#4a5d4c] text-lg font-medium leading-relaxed placeholder:text-[#4a5d4c]/15"
            placeholder={t('onboarding2_journal_placeholder')}
          />

          <div className="p-6 pt-0">
            <motion.div
              animate={{ opacity: moodContent.length > 0 ? 1 : 0.75 }}
              className="flex items-center gap-3 p-4 bg-[#8fae91]/5 rounded-2xl border border-[#8fae91]/10 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#4a5d4c] shadow-sm">
                <Sparkles size={16} className={moodContent.length > 3 ? 'animate-spin-slow' : ''} />
              </div>
              <input
                type="text"
                value={moodContent}
                onChange={(e) => setMoodContent(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-sm font-medium text-[#4a5d4c] placeholder:text-[#4a5d4c]/45"
                placeholder={t('onboarding2_journal_mood_placeholder')}
              />
            </motion.div>
          </div>

          <div className="px-6 pb-6">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleSend}
              disabled={!canSend || isSending}
              className={`w-full py-5 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 ${
                canSend && !isSending
                  ? 'bg-[#4a5d4c] text-white shadow-[#4a5d4c]/20'
                  : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/20 cursor-not-allowed shadow-none'
              }`}
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{t('onboarding2_journal_syncing')}</span>
                </>
              ) : (
                <>
                  <Rocket size={18} />
                  <span>{t('onboarding2_journal_cta')}</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
        <p className="mt-6 text-center text-[10px] text-[#4a5d4c]/30 font-bold uppercase tracking-[0.3em]">
          {t('onboarding2_journal_footer')}
        </p>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ── StepSubscription ──────────────────────────────────────────
const StepSubscription: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = React.useState('trial');

  const PLANS = [
    { id: 'trial',  name: t('onboarding2_sub_plan_trial_name'),  price: '0.00',  period: t('onboarding2_sub_plan_trial_period_unit'),  desc: t('onboarding2_sub_plan_trial_desc'),  popular: true,  tag: t('onboarding2_sub_plan_trial_tag') },
    { id: 'yearly', name: t('onboarding2_sub_plan_yearly_name'), price: '99.99', period: t('onboarding2_sub_plan_yearly_period_unit'), desc: t('onboarding2_sub_plan_yearly_desc'), popular: false, tag: t('onboarding2_sub_plan_yearly_tag') },
  ];

  const PRO_FEATURES = [
    { icon: <Sparkles size={16} />, label: t('onboarding2_sub_feat_ai_label'),     desc: t('onboarding2_sub_feat_ai_desc') },
    { icon: <TrendingUp size={16} />, label: t('onboarding2_sub_feat_growth_label'), desc: t('onboarding2_sub_feat_growth_desc') },
    { icon: <Brain size={16} />,     label: t('onboarding2_sub_feat_memory_label'), desc: t('onboarding2_sub_feat_memory_desc') },
  ];

  return (
    <div className="flex-1 flex flex-col px-6 pt-10 pb-6 overflow-y-auto no-scrollbar">
      {/* 头部标题区 */}
      <div className="text-center mb-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-4"
        >
          <Crown size={28} className="text-white fill-white/20" />
        </motion.div>
        <h2 className="text-2xl font-black text-[#4a5d4c] tracking-tight">{t('onboarding2_sub_title')}</h2>
        <p className="text-[#4a5d4c]/50 text-xs mt-1 font-medium">{t('onboarding2_sub_tagline')}</p>
      </div>

      {/* 订阅方案选择 */}
      <div className="space-y-3 mb-8">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <motion.button
              key={plan.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative w-full p-4 rounded-[28px] border-2 transition-all duration-300 text-left overflow-hidden ${
                isSelected ? 'border-purple-500 bg-purple-50/50' : 'border-white bg-white/40'
              }`}
            >
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-purple-500 border-purple-500' : 'border-[#4a5d4c]/10'
                  }`}>
                    {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isSelected ? 'text-purple-700' : 'text-[#4a5d4c]'}`}>
                        {plan.name}
                      </span>
                      {plan.tag && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          isSelected ? 'bg-purple-100 text-purple-600' : 'bg-[#4a5d4c]/10 text-[#4a5d4c]/50'
                        }`}>
                          {plan.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#4a5d4c]/40 font-medium mt-0.5">{plan.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-0.5">
                    <span className="text-[10px] font-bold text-[#4a5d4c]/30">¥</span>
                    <span className={`text-lg font-black ${isSelected ? 'text-purple-600' : 'text-[#4a5d4c]'}`}>
                      {plan.price}
                    </span>
                  </div>
                  <p className="text-[9px] text-[#4a5d4c]/30 font-bold">/{plan.period}</p>
                </div>
              </div>
              {plan.popular && (
                <div className="absolute top-0 right-0 p-1 px-3 rounded-bl-xl bg-purple-500 text-[8px] font-black text-white uppercase tracking-tighter">
                  {t('onboarding2_sub_popular_badge')}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Pro 专属功能卡片 */}
      <div className="bg-white/30 backdrop-blur-md rounded-[32px] p-5 border border-white/60 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={14} className="text-purple-500 fill-purple-500" />
          <h3 className="text-[10px] font-black text-[#4a5d4c]/40 uppercase tracking-widest">
            {t('onboarding2_sub_features_title')}
          </h3>
        </div>
        <div className="space-y-4">
          {PRO_FEATURES.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center shrink-0 text-purple-600 shadow-sm">
                {feature.icon}
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-[#4a5d4c]">{feature.label}</h4>
                <p className="text-[9px] text-[#4a5d4c]/40 font-medium">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 底部操作区 */}
      <div className="mt-auto space-y-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onFinish}
          className="w-full py-5 rounded-[28px] bg-[#4a5d4c] text-white font-black text-lg shadow-xl shadow-[#4a5d4c]/20 flex items-center justify-center gap-3 transition-transform"
        >
          <Rocket size={20} />
          {selectedPlan === 'trial' ? t('onboarding2_sub_cta_trial') : t('onboarding2_sub_cta_upgrade')}
        </motion.button>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onFinish}
            className="w-full py-4 rounded-[24px] border border-[#4a5d4c]/10 text-[#4a5d4c]/50 font-black text-xs uppercase tracking-[0.2em] hover:bg-[#4a5d4c]/5 transition-all"
          >
            {t('onboarding2_sub_skip_v2')}
          </button>
          <div className="flex items-center justify-center gap-6">
            <span className="text-[9px] text-[#4a5d4c]/30 font-bold flex items-center gap-1">
              <Check size={10} /> {t('onboarding2_sub_badge_cancel')}
            </span>
            <span className="text-[9px] text-[#4a5d4c]/30 font-bold flex items-center gap-1">
              <Check size={10} /> {t('onboarding2_sub_badge_secure')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main OnboardingFlow ───────────────────────────────────────
export const OnboardingFlow: React.FC = () => {
  const { user, updateUserProfile, userProfileV2 } = useAuthStore();
  const addTodo = useTodoStore((state) => state.addTodo);
  const addBottle = useGrowthStore((state) => state.addBottle);
  const navigate = useNavigate();

  const [step, setStep] = React.useState(1);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (user && step === 2) setStep(3);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const [routine, setRoutine] = React.useState<RoutineState>({
    region: '北京',
    identity: 'none',
    remindMe: true,
    wakeTime: DEFAULT_WAKE_TIME,
    sleepTime: DEFAULT_SLEEP_TIME,
    breakfastTime: DEFAULT_BREAKFAST,
    lunchTime: DEFAULT_LUNCH,
    dinnerTime: DEFAULT_DINNER,
    workStart: '09:00',
    workEnd: '18:00',
    classStart: '08:30',
    classEnd: '17:30',
  });

  const handleRoutineChange = <K extends keyof RoutineState>(key: K, val: RoutineState[K]) =>
    setRoutine((prev) => ({ ...prev, [key]: val }));

  const handleRequestNotificationPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      await requestNotificationPermission();
    }
  };

  const saveRoutineAndProceed = async () => {
    setSaving(true);
    const mealHours = [routine.breakfastTime, routine.lunchTime, routine.dinnerTime]
      .map(toHour).filter((h): h is number => h !== null);
    const hasWork = routine.identity === 'work';
    const hasClass = routine.identity === 'class';
    const manual: UserProfileManualV2 = {
      ...(userProfileV2?.manual || {}),
      wakeTime: routine.wakeTime || undefined,
      sleepTime: routine.sleepTime || undefined,
      mealTimes: mealHours.length ? mealHours : undefined,
      mealTimesText: [routine.breakfastTime, routine.lunchTime, routine.dinnerTime],
      lunchTime: routine.lunchTime || undefined,
      dinnerTime: routine.dinnerTime || undefined,
      hasWorkSchedule: hasWork,
      hasClassSchedule: hasClass,
      workStart: hasWork ? (routine.workStart || undefined) : undefined,
      workEnd: hasWork ? (routine.workEnd || undefined) : undefined,
      lunchStart: undefined,
      lunchEnd: undefined,
      classSchedule: hasClass ? buildClassSchedule(routine.classStart, routine.classEnd) : undefined,
      reminderEnabled: routine.remindMe,
    };
    void updateUserProfile({ manual });
    await handleRequestNotificationPermission();
    setSaving(false);
    setStep((s) => s + 1);
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    void updateUserProfile({ onboardingCompleted: true });
    navigate('/chat', { replace: true });
  };

  const handleTodoNext = (todos: OnboardingTodoDraft[]) => {
    todos.forEach((todo) => {
      addTodo({
        title: todo.text,
        priority: todo.urgency,
        recurrence: todo.repeat ? 'daily' : 'once',
        dueAt: toDueAtFromTime(todo.time),
      });
    });
    next();
  };

  const handleBottleNext = (bottles: OnboardingBottleDraft[]) => {
    bottles.forEach((bottle) => {
      addBottle(bottle.name, bottle.type);
    });
    next();
  };

  const handleLanguageNext = () => {
    if (user) {
      setStep(3);
      return;
    }
    next();
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(160deg, #eef3ef 0%, #e6ede7 100%)' }}>
        <ProgressBar step={step} />
      <div className="flex-1 overflow-hidden flex flex-col">
        {step === 1 && <StepLanguage onNext={handleLanguageNext} />}
        {step === 2 && <StepAuth onNext={next} />}
        {step === 3 && <StepAI onNext={next} />}
        {step === 4 && <StepJournal onNext={next} />}
        {step === 5 && <StepTodo onNext={handleTodoNext} />}
        {step === 6 && <StepBottle onNext={handleBottleNext} />}
        {step === 7 && (
          <OnboardingStepRoutine
            state={routine}
            onChange={handleRoutineChange}
            onNext={() => { void saveRoutineAndProceed(); }}
            saving={saving}
          />
        )}
        {step === 8 && <StepSubscription onFinish={handleComplete} />}
      </div>
    </div>
  );
};

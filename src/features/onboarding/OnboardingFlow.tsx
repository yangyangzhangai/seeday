// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/useAuthStore.ts -> src/types/userProfile.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermission } from '../../services/notifications/localNotificationService';
import { Apple, Chrome, Sparkles, Mail, ChevronRight, Lock, Loader2, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';
import { useTodoStore } from '../../store/useTodoStore';
import { useGrowthStore } from '../../store/useGrowthStore';
import { MembershipPurchaseModal } from '../../components/membership/MembershipPurchaseModal';
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
import { StepJournal } from './components/StepJournal';
import {
  AI_COMPANION_ORDER,
  AI_COMPANION_VISUALS,
} from '../../constants/aiCompanionVisuals';
import type { AiCompanionMode } from '../../lib/aiCompanion';

const TOTAL_STEPS = 7;
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

// ── StepAuth ──────────────────────────────────────────────────
const StepAuth: React.FC<{ onNext: () => void }> = ({ onNext }) => {
  const { t } = useTranslation();
  const { signIn, signUp, verifySignUpCode, signInWithApple, signInWithGoogle } = useAuthStore();
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [nickname, setNickname] = React.useState('');
  const [verificationCode, setVerificationCode] = React.useState('');
  const [pendingSignUpEmail, setPendingSignUpEmail] = React.useState<string | null>(null);
  const [isLogin, setIsLogin] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const getErrorMessage = (msg: string) => {
    if (msg.includes('email rate limit exceeded')) return t('auth_error_rate_limit');
    if (msg.includes('Invalid login credentials')) return t('auth_error_invalid_credentials');
    if (msg.includes('User already registered')) return t('auth_error_user_exists');
    if (msg.includes('Password should be at least')) return t('auth_error_password_short');
    if (msg.includes('invalid_grant')) return t('auth_error_invalid_grant');
    if (msg.includes('Token has expired') || msg.includes('token is expired')) return t('auth_error_invalid_grant');
    if (msg.includes('Invalid token') || msg.includes('invalid token')) return t('auth_error_invalid_grant');
    return t('auth_error_generic') + msg;
  };

  const resetSignUpCodeState = () => {
    setVerificationCode('');
    setPendingSignUpEmail(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const acc = identifier.trim();
      if (!isValidEmail(acc)) throw new Error(t('auth_error_invalid_account'));
      const emailToUse = acc;
      if (isLogin) {
        const { error: err } = await signIn(emailToUse, password);
        if (err) throw err;
        onNext();
      } else {
        if (pendingSignUpEmail) {
          const { error: verifyError } = await verifySignUpCode(pendingSignUpEmail, verificationCode);
          if (verifyError) throw verifyError;
          resetSignUpCodeState();
          onNext();
        } else {
          const { error: err } = await signUp(emailToUse, password, nickname || undefined);
          if (err) throw err;
          setPendingSignUpEmail(emailToUse);
          setMessage(t('auth_register_success'));
        }
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

  const canSubmit = isLogin
    ? Boolean(identifier.trim() && password.length >= 6 && !loading)
    : pendingSignUpEmail
      ? Boolean(verificationCode.trim().length >= 4 && !loading)
      : Boolean(identifier.trim() && password.length >= 6 && !loading);

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
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (!isLogin) {
                resetSignUpCodeState();
                setMessage(null);
              }
            }}
            placeholder={t('auth_account_placeholder')}
            className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm"
          />
        </div>

        {/* 昵称（仅注册） */}
        {!isLogin && !pendingSignUpEmail && (
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

        {pendingSignUpEmail ? (
          <div className="bg-white/60 backdrop-blur-xl border border-white p-5 rounded-[24px] shadow-sm flex items-center gap-3 group focus-within:border-[#8fae91] focus-within:bg-white transition-all">
            <div className="text-[#4a5d4c]/30 group-focus-within:text-[#4a5d4c] transition-colors">
              <Lock size={20} />
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.trim())}
              onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
              className="flex-1 bg-transparent border-none outline-none text-[#4a5d4c] font-bold placeholder:text-[#4a5d4c]/20 text-sm"
            />
          </div>
        ) : (
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
        )}

        {/* 错误 / 成功提示 */}
        {error && <p className="text-red-500 text-xs px-2">{error}</p>}
        {message && <p className="text-[#4a5d4c] text-xs px-2">{message}</p>}
        {/* 切换登录/注册 */}
        <p className="text-center text-xs text-[#4a5d4c]/40 pt-1">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setMessage(null);
              resetSignUpCodeState();
            }}
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

// ── StepSubscription ──────────────────────────────────────────
const StepSubscription: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const navigate = useNavigate();

  const handlePurchase = (planId: 'monthly' | 'yearly') => {
    navigate('/upgrade', {
      state: {
        disableInitialAnimation: true,
        initialPlanId: planId,
      },
    });
  };

  return <MembershipPurchaseModal isOpen onClose={onFinish} onPurchase={handlePurchase} disableInitialAnimation />;
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
    if (user && step === 1) setStep(2);
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

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'linear-gradient(160deg, #eef3ef 0%, #e6ede7 100%)' }}>
        <ProgressBar step={step} />
      <div className="flex-1 overflow-hidden flex flex-col">
        {step === 1 && <StepAuth onNext={next} />}
        {step === 2 && <StepAI onNext={next} />}
        {step === 3 && <StepJournal onNext={next} />}
        {step === 4 && <StepTodo onNext={handleTodoNext} />}
        {step === 5 && <StepBottle onNext={handleBottleNext} />}
        {step === 6 && (
          <OnboardingStepRoutine
            state={routine}
            onChange={handleRoutineChange}
            onNext={() => { void saveRoutineAndProceed(); }}
            saving={saving}
          />
        )}
        {step === 7 && <StepSubscription onFinish={handleComplete} />}
      </div>
    </div>
  );
};

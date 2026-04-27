// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/auth/README.md -> src/store/useAuthStore.ts
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { Apple, Chrome, Mail, Lock, Loader2, User, ChevronRight, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';

export const AuthPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const { signIn, signUp, verifySignUpCode, resendSignUpCode, signInWithApple, signInWithGoogle } = useAuthStore();
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
  const [resendLoading, setResendLoading] = React.useState(false);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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

  const handleResend = async () => {
    if (!pendingSignUpEmail) return;
    setResendLoading(true);
    setError(null);
    try {
      const { error } = await resendSignUpCode(pendingSignUpEmail);
      if (error) throw error;
      setMessage(t('auth_register_success'));
    } catch (err: any) {
      setError(getErrorMessage(err.message || t('auth_error_generic')));
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const account = identifier.trim();
      if (!isValidEmail(account)) {
        throw new Error(t('auth_error_invalid_account'));
      }
      const emailToUse = account;
      if (isLogin) {
        const { error: signInError } = await signIn(emailToUse, password);
        if (signInError) throw signInError;
        navigate('/chat', { replace: true });
      } else {
        if (pendingSignUpEmail) {
          const { error: verifyError } = await verifySignUpCode(pendingSignUpEmail, verificationCode);
          if (verifyError) throw verifyError;
          resetSignUpCodeState();
          navigate('/chat', { replace: true });
        } else {
          const { error: signUpError } = await signUp(emailToUse, password, nickname || undefined);
          if (signUpError) throw signUpError;
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
    const { error: signInError } = await signInWithApple();
    if (signInError) {
      setError(getErrorMessage(signInError.message || t('auth_error_generic')));
      setAppleLoading(false);
      return;
    }
    navigate('/chat', { replace: true });
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error: signInError } = await signInWithGoogle();
    if (signInError) {
      setError(getErrorMessage(signInError.message || t('auth_error_generic')));
      setGoogleLoading(false);
    }
  };

  const canSubmit = isLogin
    ? Boolean(identifier.trim() && password.length >= 6 && !loading)
    : pendingSignUpEmail
      ? Boolean(verificationCode.trim().length >= 4 && !loading)
      : Boolean(identifier.trim() && password.length >= 6 && !loading);

  if (authLoading) {
    return <div className="fixed inset-0 bg-gray-50" />;
  }
  if (user) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#f4f7f4] px-8 pt-safe pb-safe">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col pt-16 pb-12">
        <div className="mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mb-6 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#8fae91]/20 shadow-inner"
          >
            <Sparkles className="text-[#4a5d4c]" size={32} />
          </motion.div>

          <h1 className="text-3xl font-black leading-tight tracking-tight text-[#4a5d4c]">
            {isLogin ? t('auth_welcome_back') : t('auth_create_account')}
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-[#4a5d4c]/60">
            {isLogin ? t('auth_login_subtitle') : t('auth_register_subtitle')}
          </p>
        </div>

        <div className="space-y-3">
          <div className="group flex items-center gap-3 rounded-[24px] border border-white bg-white/60 p-5 shadow-sm backdrop-blur-xl transition-all focus-within:border-[#8fae91] focus-within:bg-white">
            <div className="text-[#4a5d4c]/30 transition-colors group-focus-within:text-[#4a5d4c]">
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
                className="flex-1 border-none bg-transparent text-sm font-bold text-[#4a5d4c] outline-none placeholder:text-[#4a5d4c]/20"
              />
            </div>

          {!isLogin && !pendingSignUpEmail ? (
            <div className="group flex items-center gap-3 rounded-[24px] border border-white bg-white/60 p-5 shadow-sm backdrop-blur-xl transition-all focus-within:border-[#8fae91] focus-within:bg-white">
              <div className="text-[#4a5d4c]/30 transition-colors group-focus-within:text-[#4a5d4c]">
                <User size={20} />
              </div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t('auth_nickname_placeholder')}
                className="flex-1 border-none bg-transparent text-sm font-bold text-[#4a5d4c] outline-none placeholder:text-[#4a5d4c]/20"
              />
            </div>
          ) : null}

          {pendingSignUpEmail ? (
            <div className="group flex items-center gap-3 rounded-[24px] border border-white bg-white/60 p-5 shadow-sm backdrop-blur-xl transition-all focus-within:border-[#8fae91] focus-within:bg-white">
              <div className="text-[#4a5d4c]/30 transition-colors group-focus-within:text-[#4a5d4c]">
                <Lock size={20} />
              </div>
              <input
                type="text"
                inputMode="numeric"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) {
                    void handleSubmit();
                  }
                }}
                placeholder={t('auth_otp_placeholder')}
                className="flex-1 border-none bg-transparent text-sm font-bold text-[#4a5d4c] outline-none placeholder:text-[#4a5d4c]/20"
              />
            </div>
          ) : (
            <div className="group flex items-center gap-3 rounded-[24px] border border-white bg-white/60 p-5 shadow-sm backdrop-blur-xl transition-all focus-within:border-[#8fae91] focus-within:bg-white">
              <div className="text-[#4a5d4c]/30 transition-colors group-focus-within:text-[#4a5d4c]">
                <Lock size={20} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) {
                    void handleSubmit();
                  }
                }}
                placeholder={t('onboarding2_auth_password_placeholder')}
                className="flex-1 border-none bg-transparent text-sm font-bold text-[#4a5d4c] outline-none placeholder:text-[#4a5d4c]/20"
              />
            </div>
          )}

          {pendingSignUpEmail ? (
            <div className="flex justify-end px-1">
              <button
                type="button"
                onClick={() => { void handleResend(); }}
                disabled={resendLoading}
                className="text-xs font-bold text-[#4a5d4c]/50 underline decoration-[#4a5d4c]/20 disabled:opacity-40"
              >
                {resendLoading ? <Loader2 size={12} className="inline animate-spin mr-1" /> : null}
                {t('auth_resend_code')}
              </button>
            </div>
          ) : null}
          {error ? <p className="px-2 text-xs text-red-500">{error}</p> : null}
          {message ? <p className="px-2 text-xs text-[#4a5d4c]">{message}</p> : null}
          <p className="pt-1 text-center text-xs text-[#4a5d4c]/40">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setMessage(null);
                resetSignUpCodeState();
              }}
              className="ml-1 font-bold text-[#4a5d4c] underline decoration-[#4a5d4c]/20"
            >
              {isLogin ? t('auth_switch_to_register') : t('auth_switch_to_login')}
            </button>
          </p>

          <div className="flex items-center gap-4 py-1">
            <div className="h-[1px] flex-1 bg-[#4a5d4c]/5" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4a5d4c]/20">{t('auth_or_divider')}</span>
            <div className="h-[1px] flex-1 bg-[#4a5d4c]/5" />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleAppleSignIn}
              disabled={appleLoading || googleLoading}
              className="flex flex-1 items-center justify-center gap-3 rounded-[24px] border border-white bg-white/60 p-5 font-bold text-[#4a5d4c] shadow-sm backdrop-blur-xl transition-all hover:bg-white hover:shadow-md disabled:opacity-50"
            >
              {appleLoading ? <Loader2 size={20} className="animate-spin" /> : <Apple size={20} fill="currentColor" />}
              <span className="text-sm">Apple</span>
            </button>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={appleLoading || googleLoading}
              className="flex flex-1 items-center justify-center gap-3 rounded-[24px] border border-white bg-white/60 p-5 font-bold text-[#4a5d4c] shadow-sm backdrop-blur-xl transition-all hover:bg-white hover:shadow-md disabled:opacity-50"
            >
              {googleLoading ? <Loader2 size={20} className="animate-spin" /> : <Chrome size={20} />}
              <span className="text-sm">Google</span>
            </button>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => { void handleSubmit(); }}
            disabled={!canSubmit}
            className={`flex w-full items-center justify-center gap-2 rounded-[28px] py-5 text-lg font-bold transition-all ${
              canSubmit
                ? 'bg-[#4a5d4c] text-white shadow-xl shadow-[#4a5d4c]/20 hover:bg-[#3d4d3f]'
                : 'cursor-not-allowed bg-[#4a5d4c]/10 text-[#4a5d4c]/20 shadow-none'
            }`}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                {isLogin ? t('auth_login_button') : pendingSignUpEmail ? t('auth_verify_button') : t('auth_register_button')} <ChevronRight size={20} />
              </>
            )}
          </motion.button>

          <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-[#4a5d4c]/30">
            {t('onboarding2_auth_agreement')}
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { ArrowLeft, Mail, Lock, Loader2, User, MoreHorizontal, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { APP_MODAL_CARD_CLASS, APP_MODAL_CLOSE_CLASS, APP_MODAL_OVERLAY_CLASS } from '../../lib/modalTheme';

export const AuthPage = () => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, signInWithApple, signUp, updateAvatar } = useAuthStore();
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const resizeImageToDataUrl = (file: File, maxSize = 640, quality = 0.95): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

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

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError(null);
    const { error } = await signInWithApple();
    if (error) {
      setError(getErrorMessage(error.message || t('auth_error_generic')));
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError(getErrorMessage(error.message || t('auth_error_generic')));
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const acc = account.trim();
      const isPhone = isValidPhone(acc);
      const isEmail = isValidEmail(acc);
      if (!isPhone && !isEmail) {
        throw new Error(t('auth_error_invalid_account'));
      }
      const emailToUse = isPhone ? toPhoneAliasEmail(acc) : acc;

      if (isLogin) {
        const { error } = await signIn(emailToUse, password);
        if (error) throw error;
        if (avatarPreview) {
          await updateAvatar(avatarPreview);
        }
        navigate('/');
      } else {
        const { error } = await signUp(emailToUse, password, nickname, avatarPreview || undefined);
        if (error) throw error;
        setMessage(t('auth_register_success'));
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(getErrorMessage(err.message || t('auth_error_generic')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#fcfaf7] px-4">
      {/* Ambient background blurs */}
      <div className="pointer-events-none fixed right-0 top-0 h-[260px] w-[260px] rounded-full bg-[#B2EEDA]/20 blur-[90px]" />
      <div className="pointer-events-none fixed bottom-[100px] left-0 h-[200px] w-[200px] rounded-full bg-rose-200/20 blur-[70px]" />
      <div className="pointer-events-none fixed left-1/2 top-1/3 h-[180px] w-[180px] -translate-x-1/2 rounded-full bg-[#8FAF92]/10 blur-[80px]" />

      {/* Back button */}
      <div className="absolute left-4 top-4 z-10">
        <button
          onClick={() => navigate('/')}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[#2F3E33] shadow-[inset_0_1px_1px_rgba(255,255,255,0.72),0_8px_18px_rgba(148,163,184,0.2)] transition-colors hover:bg-white"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Main card */}
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/65 px-6 py-8"
        style={{
          background: 'rgba(252,250,247,0.88)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.75), 0 24px 64px rgba(15,23,42,0.10)',
        }}
      >
        {/* Decorative inner glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(143,175,146,0.30) 0%, rgba(143,175,146,0.06) 60%, transparent 80%)',
          }}
        />

        {/* Header */}
        <div className="mb-6 text-center">
          <h2
            className="text-2xl font-extrabold text-[#1e293b]"
            style={{ letterSpacing: '-0.02em' }}
          >
            {isLogin ? t('auth_welcome_back') : t('auth_create_account')}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            {isLogin ? t('auth_login_subtitle') : t('auth_register_subtitle')}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Avatar picker (register only) */}
          {!isLogin && (
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="h-[72px] w-[72px] cursor-pointer overflow-hidden rounded-full border-2 border-white/90 bg-[#F0F4F1] shadow-[0_4px_14px_rgba(148,163,184,0.22)] transition-opacity hover:opacity-80"
                onClick={() => {
                  setShowAvatarModal(true);
                  setShowAvatarMenu(false);
                }}
                title={t('auth_select_avatar')}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="text-[#8FAF92]" size={30} />
                  </div>
                )}
              </div>
              <input
                id="avatar-input"
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const dataUrl = await resizeImageToDataUrl(f, 640, 0.95);
                  setAvatarPreview(dataUrl);
                  setShowAvatarMenu(false);
                  setShowAvatarModal(false);
                }}
              />
            </div>
          )}

          {/* Account input */}
          <div>
            <label htmlFor="account" className="sr-only">{t('auth_account_label')}</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Mail className="h-4 w-4 text-[#8FAF92]" />
              </div>
              <input
                id="account"
                name="account"
                type="text"
                required
                className="w-full rounded-xl border border-[#8FAF92]/40 bg-white/85 py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-shadow focus:border-[#8FAF92]/70 focus:ring-2 focus:ring-[#8FAF92]/25"
                placeholder={t('auth_account_placeholder')}
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
            </div>
          </div>

          {/* Nickname input (register only) */}
          {!isLogin && (
            <div>
              <label htmlFor="nickname" className="sr-only">{t('auth_nickname_label')}</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <User className="h-4 w-4 text-[#8FAF92]" />
                </div>
                <input
                  id="nickname"
                  name="nickname"
                  type="text"
                  className="w-full rounded-xl border border-[#8FAF92]/40 bg-white/85 py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-shadow focus:border-[#8FAF92]/70 focus:ring-2 focus:ring-[#8FAF92]/25"
                  placeholder={t('auth_nickname_placeholder')}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Password input */}
          <div>
            <label htmlFor="password" className="sr-only">{t('auth_password_label')}</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Lock className="h-4 w-4 text-[#8FAF92]" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full rounded-xl border border-[#8FAF92]/40 bg-white/85 py-2.5 pl-10 pr-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition-shadow focus:border-[#8FAF92]/70 focus:ring-2 focus:ring-[#8FAF92]/25"
                placeholder={t('auth_password_placeholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Error / success messages */}
          {error && (
            <div className="rounded-xl border border-red-200/60 bg-red-50/80 px-3 py-2 text-center text-xs text-red-500">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-xl border border-[#8FAF92]/40 bg-[#F0F4F1]/80 px-3 py-2 text-center text-xs text-[#5F7A63]">
              {message}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="relative w-full overflow-hidden rounded-2xl py-2.5 text-sm font-semibold text-[#2F3E33] shadow-[0px_2px_2px_#C8C8C8] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: 'rgba(144.67,212.06,122.21,0.22)',
              border: '1px solid rgba(143,175,146,0.45)',
            }}
          >
            {loading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : (
              isLogin ? t('auth_login_button') : t('auth_register_button')
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200/70" />
          <span className="text-[11px] font-medium text-slate-400">{t('auth_or_divider')}</span>
          <div className="h-px flex-1 bg-slate-200/70" />
        </div>

        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="mb-3 w-full overflow-hidden rounded-2xl border border-white/70 bg-white/80 py-2.5 text-sm font-medium text-slate-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.72),0_4px_12px_rgba(148,163,184,0.12)] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="flex items-center justify-center gap-2.5">
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"/>
              </svg>
            )}
            <span>{t('auth_google_signin')}</span>
          </div>
        </button>

        {/* Apple sign-in */}
        <button
          type="button"
          onClick={handleAppleSignIn}
          disabled={appleLoading || loading}
          className="w-full overflow-hidden rounded-2xl py-2.5 text-sm font-medium text-white shadow-[0_4px_12px_rgba(15,23,42,0.22)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'linear-gradient(160deg, #1c1c1e 0%, #2c2c2e 100%)' }}
        >
          <div className="flex items-center justify-center gap-2.5">
            {appleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <svg width="15" height="18" viewBox="0 0 17 20" fill="white" aria-hidden="true">
                <path d="M13.805 10.566c-.02-2.184 1.786-3.237 1.867-3.29-1.018-1.49-2.602-1.694-3.166-1.716-1.347-.136-2.632.796-3.315.796-.683 0-1.74-.776-2.86-.754-1.464.022-2.818.854-3.573 2.165C1.08 10.22 2.16 14.37 3.797 16.62c.795 1.15 1.742 2.44 2.984 2.394 1.198-.048 1.649-.77 3.096-.77 1.447 0 1.854.77 3.12.746 1.29-.022 2.103-1.166 2.893-2.32a11.3 11.3 0 0 0 1.317-2.688c-.03-.013-2.52-.967-2.542-3.416zM11.537 3.724c.657-.8 1.1-1.91.977-3.018-.943.04-2.085.63-2.763 1.43-.607.7-1.138 1.823-.994 2.9 1.051.08 2.124-.535 2.78-1.312z"/>
              </svg>
            )}
            <span>{t('auth_apple_signin')}</span>
          </div>
        </button>

        {/* Toggle login / register */}
        <div className="mt-5 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
              setMessage(null);
            }}
            className="text-sm font-medium text-[#5F7A63] transition-colors hover:text-[#2F3E33]"
          >
            {isLogin ? t('auth_switch_to_register') : t('auth_switch_to_login')}
          </button>
        </div>
      </div>

      {/* Avatar preview modal */}
      {showAvatarModal && (
        <div
          className={cn('fixed inset-0 flex items-center justify-center z-50 p-4', APP_MODAL_OVERLAY_CLASS)}
          onClick={() => {
            setShowAvatarModal(false);
            setShowAvatarMenu(false);
          }}
        >
          <div
            className={cn(APP_MODAL_CARD_CLASS, 'relative rounded-2xl overflow-hidden')}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={cn(APP_MODAL_CLOSE_CLASS, 'absolute right-2 top-2 p-1.5')}
              onClick={() => {
                setShowAvatarModal(false);
                setShowAvatarMenu(false);
              }}
              title={t('auth_close')}
            >
              <X size={16} />
            </button>
            <button
              className={cn(APP_MODAL_CLOSE_CLASS, 'absolute right-10 top-2 p-1.5')}
              onClick={() => setShowAvatarMenu((v) => !v)}
              title={t('auth_more')}
            >
              <MoreHorizontal size={16} />
            </button>
            {showAvatarMenu && (
              <div className={cn(APP_MODAL_CARD_CLASS, 'absolute right-2 top-10 rounded-lg overflow-hidden')}>
                <button
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-white/70 w-full text-left"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {t('auth_change_avatar')}
                </button>
              </div>
            )}
            <div className="w-[280px] h-[280px] bg-[#F0F4F1] flex items-center justify-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar large" className="w-full h-full object-cover" />
              ) : (
                <User className="text-[#8FAF92]" size={100} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

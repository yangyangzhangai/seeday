import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { ArrowLeft, Mail, Lock, Loader2, User, MoreHorizontal, X } from 'lucide-react';

export const AuthPage = () => {
  const navigate = useNavigate();
  const { signIn, signUp, updateAvatar } = useAuthStore();
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const resizeImageToDataUrl = (file: File, maxSize = 160): Promise<string> => {
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
          resolve(canvas.toDataURL('image/jpeg', 0.85));
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
        navigate('/'); // Go back to home page
      } else {
        const { error } = await signUp(emailToUse, password, nickname, avatarPreview || undefined);
        if (error) throw error;
        setMessage(t('auth_register_success'));
        setIsLogin(true); // Switch to login view
      }
    } catch (err: any) {
      setError(getErrorMessage(err.message || t('auth_error_generic')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-4 relative z-10">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 -mt-20">
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-sm">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              {isLogin ? t('auth_welcome_back') : t('auth_create_account')}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {isLogin ? t('auth_login_subtitle') : t('auth_register_subtitle')}
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center cursor-pointer"
                    onClick={() => {
                      setShowAvatarModal(true);
                      setShowAvatarMenu(false);
                    }}
                    title={t('auth_select_avatar')}
                  >
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="avatar preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="text-gray-400" size={36} />
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
                      const dataUrl = await resizeImageToDataUrl(f, 160);
                      setAvatarPreview(dataUrl);
                      setShowAvatarMenu(false);
                      setShowAvatarModal(false);
                    }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="account" className="sr-only">{t('auth_account_label')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="account"
                    name="account"
                    type="text"
                    required
                    className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder={t('auth_account_placeholder')}
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label htmlFor="nickname" className="sr-only">{t('auth_nickname_label')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="nickname"
                      name="nickname"
                      type="text"
                      className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder={t('auth_nickname_placeholder')}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="password" className="sr-only">{t('auth_password_label')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="appearance-none rounded-lg relative block w-full pl-10 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder={t('auth_password_placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            {message && (
              <div className="text-green-500 text-sm text-center bg-green-50 p-2 rounded">
                {message}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  isLogin ? t('auth_login_button') : t('auth_register_button')
                )}
              </button>
            </div>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setMessage(null);
              }}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              {isLogin ? t('auth_switch_to_register') : t('auth_switch_to_login')}
            </button>
          </div>
        </div>
      </div>

      {showAvatarModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAvatarModal(false);
            setShowAvatarMenu(false);
          }}
        >
          <div
            className="relative bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-2 top-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 shadow"
              onClick={() => {
                setShowAvatarModal(false);
                setShowAvatarMenu(false);
              }}
              title={t('auth_close')}
            >
              <X size={16} />
            </button>
            <button
              className="absolute right-10 top-2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-600 shadow"
              onClick={() => setShowAvatarMenu((v) => !v)}
              title={t('auth_more')}
            >
              <MoreHorizontal size={16} />
            </button>
            {showAvatarMenu && (
              <div className="absolute right-2 top-10 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
                <button
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {t('auth_change_avatar')}
                </button>
              </div>
            )}
            <div className="w-[280px] h-[280px] bg-gray-100 flex items-center justify-center">
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar large" className="w-full h-full object-cover" />
              ) : (
                <User className="text-gray-300" size={120} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

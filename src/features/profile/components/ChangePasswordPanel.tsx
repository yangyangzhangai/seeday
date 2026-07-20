// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoSheetPanel } from './InfoSheetPanel';
import { supabase } from '../../../api/supabase';

interface Props {
  hasEmailIdentity: boolean;
  onClose: () => void;
}

export const ChangePasswordPanel: React.FC<Props> = ({ hasEmailIdentity, onClose }) => {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const title = hasEmailIdentity
    ? t('change_password_title_change')
    : t('change_password_title_set');

  const verifyCurrentPassword = async (): Promise<boolean> => {
    if (!hasEmailIdentity) return true;
    const { data, error: userError } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (userError || !email || !currentPassword) return false;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    return !error;
  };

  const handleSave = async () => {
    setErrorMsg('');
    if (newPassword.length < 6) {
      setErrorMsg(t('change_password_too_short'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t('change_password_mismatch'));
      return;
    }
    setStatus('loading');
    const isCurrentPasswordValid = await verifyCurrentPassword();
    if (!isCurrentPasswordValid) {
      setErrorMsg(t('auth_error_invalid_credentials'));
      setStatus('error');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setErrorMsg(t('change_password_error'));
      setStatus('error');
      return;
    }
    setStatus('success');
  };

  return (
    <InfoSheetPanel title={title} onClose={onClose}>
      {!hasEmailIdentity && (
        <p className="mb-5 text-sm leading-relaxed text-slate-500">
          {t('change_password_hint')}
        </p>
      )}

      <div className="space-y-3">
        {hasEmailIdentity && (
          <input
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder={t('auth_password_placeholder')}
            autoComplete="current-password"
            disabled={status === 'loading' || status === 'success'}
            className="w-full rounded-xl border border-white/65 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#8FAF92]/60 focus:ring-0 disabled:opacity-50"
          />
        )}
        <input
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder={t('change_password_new_placeholder')}
          autoComplete="new-password"
          disabled={status === 'loading' || status === 'success'}
          className="w-full rounded-xl border border-white/65 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#8FAF92]/60 focus:ring-0 disabled:opacity-50"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder={t('change_password_confirm_placeholder')}
          autoComplete="new-password"
          disabled={status === 'loading' || status === 'success'}
          className="w-full rounded-xl border border-white/65 bg-white/80 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#8FAF92]/60 focus:ring-0 disabled:opacity-50"
        />
      </div>

      {errorMsg && (
        <p className="mt-3 text-xs text-red-500">{errorMsg}</p>
      )}
      {status === 'success' && (
        <p className="mt-3 text-xs text-[#5F7A63]">{t('change_password_success')}</p>
      )}

      <button
        type="button"
        onClick={() => { void handleSave(); }}
        disabled={status === 'loading' || status === 'success' || (hasEmailIdentity && !currentPassword) || !newPassword || !confirmPassword}
        className="mt-5 w-full rounded-[50px] py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: '#5F7A63' }}
      >
        {status === 'loading' ? '…' : t('change_password_save')}
      </button>

      <div className="h-4" />
    </InfoSheetPanel>
  );
};

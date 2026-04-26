// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import { supabase } from '../../../api/supabase';

const GRACE_DAYS = 5;

interface Props {
  onClose: () => void;
}

export const DeleteAccountModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useAuthStore();
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      const deletionAt = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await supabase.auth.updateUser({
        data: { pending_deletion_at: deletionAt },
      });
      if (updateError) throw updateError;
      await signOut();
      navigate('/onboarding', { replace: true });
    } catch {
      setError(t('delete_account_error'));
      setLoading(false);
    }
  };

  const DELETE_ITEMS = [
    t('delete_account_item1'),
    t('delete_account_item2'),
    t('delete_account_item3'),
    t('delete_account_item4'),
    t('delete_account_item5'),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-0 pb-0"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl bg-[#F7F9F8] px-5 pt-6 shadow-2xl overflow-y-auto"
        style={{
          maxHeight: '88dvh',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 32px)',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" />

        {/* Title */}
        <div className="mb-4 flex items-center gap-2.5">
          <AlertTriangle size={20} strokeWidth={2} className="shrink-0 text-red-500" />
          <h2 className="text-base font-semibold text-slate-800">{t('delete_account_title')}</h2>
        </div>

        {/* Subscription reminder */}
        <div className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-amber-700">{t('delete_account_subscription_title')}</p>
          <p className="text-xs leading-relaxed text-amber-600">{t('delete_account_subscription_body')}</p>
        </div>

        {/* Grace period note */}
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-blue-200/60 bg-blue-50/60 px-4 py-3">
          <Info size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-blue-400" />
          <p className="text-xs leading-relaxed text-blue-600">{t('delete_account_grace_note')}</p>
        </div>

        {/* What gets deleted */}
        <p className="mb-2 text-xs font-medium text-slate-500">{t('delete_account_warning')}</p>
        <ul className="mb-4 space-y-1">
          {DELETE_ITEMS.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              {item}
            </li>
          ))}
        </ul>

        {/* Confirm checkbox */}
        <label className="mb-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-red-500"
          />
          <span className="text-xs leading-relaxed text-slate-600">{t('delete_account_confirm_label')}</span>
        </label>

        {/* Error */}
        {error && (
          <p className="mb-3 text-xs text-red-500">{error}</p>
        )}

        {/* Buttons */}
        <button
          onClick={handleDelete}
          disabled={!confirmed || loading}
          className="mb-2.5 w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: confirmed ? '#ef4444' : '#fca5a5' }}
        >
          {loading ? t('delete_account_loading') : t('delete_account_button')}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="w-full rounded-xl border border-slate-200/60 bg-white/80 py-3 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-40"
        >
          {t('delete_account_cancel')}
        </button>
      </div>
    </div>
  );
};

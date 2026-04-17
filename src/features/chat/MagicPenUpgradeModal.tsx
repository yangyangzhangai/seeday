// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React from 'react';
import { Crown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_MODAL_SECONDARY_BUTTON_CLASS,
} from '../../lib/modalTheme';

interface MagicPenUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MagicPenUpgradeModal: React.FC<MagicPenUpgradeModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) {
    return null;
  }

  const handleUpgrade = () => {
    onClose();
    navigate('/upgrade');
  };

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center sm:p-6', APP_MODAL_OVERLAY_CLASS)}
      onClick={onClose}
    >
      <div
        className={cn(
          APP_MODAL_CARD_CLASS,
          'relative w-full max-w-sm rounded-t-3xl px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-6 sm:rounded-3xl sm:pb-4 animate-in fade-in slide-in-from-bottom-10 sm:zoom-in-95',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className={cn(APP_MODAL_CLOSE_CLASS, 'absolute right-3 top-3 flex h-7 w-7 items-center justify-center')}
          aria-label={t('auth_close')}
          title={t('auth_close')}
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        <div className="mb-4 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[#E6EBD8] bg-[#EEF4E8]">
            <Crown size={24} strokeWidth={1.5} className="text-[#5F7A63]" />
          </div>
          <h3 className="mb-1 text-base font-bold text-slate-800">{t('chat_magic_pen_upgrade_title')}</h3>
          <p className="text-xs leading-relaxed text-slate-500">{t('chat_magic_pen_upgrade_desc')}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleUpgrade}
            className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'w-full py-2.5 text-sm font-bold active:scale-95')}
          >
            {t('chat_magic_pen_upgrade_cta')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'w-full py-2 text-xs active:opacity-60')}
          >
            {t('chat_magic_pen_upgrade_later')}
          </button>
        </div>
      </div>
    </div>
  );
};

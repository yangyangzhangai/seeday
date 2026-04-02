import React from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_MODAL_SECONDARY_BUTTON_CLASS,
} from '../../lib/modalTheme';

interface UpgradeModalProps {
  onClose: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    navigate('/profile');
  };

  return (
    <div
      className={cn('fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in', APP_MODAL_OVERLAY_CLASS)}
      onClick={onClose}
    >
      <div
        className={cn(APP_MODAL_CARD_CLASS, 'relative w-full max-w-xs rounded-3xl overflow-hidden animate-in zoom-in-95')}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-6 pb-4 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3 border border-[#E6EBD8] bg-[#EEF4E8]">
            <Crown size={24} className="text-[#5F7A63]" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">{t('report_upgrade_title')}</h3>
          <p className="text-xs leading-relaxed text-slate-500">{t('report_upgrade_desc')}</p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 flex flex-col gap-2.5">
          <button
            onClick={handleUpgrade}
            className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'w-full py-2.5 text-sm font-bold active:scale-95')}
          >
            {t('report_upgrade_btn')}
          </button>
          <button
            onClick={onClose}
            className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'w-full py-2 text-xs active:opacity-60')}
          >
            {t('report_upgrade_later')}
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(APP_MODAL_CLOSE_CLASS, 'absolute top-3 right-3 w-7 h-7 flex items-center justify-center')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

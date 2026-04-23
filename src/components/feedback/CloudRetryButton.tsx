// DOC-DEPS: LLM.md -> src/store/README.md
import { Cloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CloudRetryButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function CloudRetryButton({ onClick, disabled = false, className = '', title }: CloudRetryButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg bg-[#A86B2B] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <Cloud size={14} strokeWidth={2.2} />
      <span>{t('retry')}</span>
    </button>
  );
}

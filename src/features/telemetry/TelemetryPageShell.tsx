// DOC-DEPS: LLM.md -> src/features/telemetry/TelemetryHubPage.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface TelemetryPageShellProps {
  children: React.ReactNode;
  backTo: string;
  maxWidthClass?: string;
}

export const TelemetryPageShell: React.FC<TelemetryPageShellProps> = ({
  children,
  backTo,
  maxWidthClass = 'max-w-6xl',
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div
        className={`mx-auto ${maxWidthClass} space-y-4 px-4`}
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        }}
      >
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm active:bg-gray-50"
        >
          <ArrowLeft size={16} strokeWidth={2.2} />
          <span>{t('upgrade_back')}</span>
        </button>
        {children}
      </div>
    </div>
  );
};

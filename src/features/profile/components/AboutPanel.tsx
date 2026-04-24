// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoSheetPanel } from './InfoSheetPanel';
import { PrivacyPolicyPanel } from './PrivacyPolicyPanel';

const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'houanni1314@gmail.com';

interface Props {
  onClose: () => void;
}

export const AboutPanel: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const [showPrivacy, setShowPrivacy] = useState(false);

  if (showPrivacy) {
    return <PrivacyPolicyPanel onClose={() => setShowPrivacy(false)} />;
  }

  return (
    <InfoSheetPanel title={t('about_sheet_title')} onClose={onClose}>
      <div className="flex flex-col items-center pt-6 pb-8">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[22px] bg-gradient-to-br from-[#5F7A63] to-[#3d5c42] shadow-lg">
          <span className="text-3xl font-bold text-white">S</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800">Seeday</h1>
        <p className="mt-1 text-sm text-[#5F7A63]">{t('about_tagline')}</p>
        <p className="mt-4 max-w-xs text-center text-sm leading-relaxed text-slate-500">
          {t('about_desc')}
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-white/65 bg-white/70 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_4px_12px_rgba(148,163,184,0.08)]">
        <Row label={t('about_version_label')} value={APP_VERSION} />
        <Divider />
        <Row label={t('about_developer_label')} value={t('about_developer_name')} />
        <Divider />
        <Row
          label={t('about_support_label')}
          value={SUPPORT_EMAIL}
          href={`mailto:${SUPPORT_EMAIL}`}
        />
        <Divider />
        <button
          onClick={() => setShowPrivacy(true)}
          className="flex w-full items-center justify-between px-4 py-3 transition hover:bg-white/70"
        >
          <span className="text-sm text-slate-700">{t('about_privacy_link')}</span>
          <span className="text-sm text-[#5F7A63]">›</span>
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">{t('about_copyright')}</p>
    </InfoSheetPanel>
  );
};

const Divider = () => <div className="mx-4 border-t border-slate-200/60" />;

interface RowProps {
  label: string;
  value: string;
  href?: string;
}

const Row: React.FC<RowProps> = ({ label, value, href }) => (
  <div className="flex min-h-[44px] items-center justify-between px-4 py-3">
    <span className="text-sm text-slate-700">{label}</span>
    {href ? (
      <a href={href} className="text-sm text-[#5F7A63] active:opacity-60">
        {value}
      </a>
    ) : (
      <span className="text-sm text-slate-500">{value}</span>
    )}
  </div>
);

// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { InfoSheetPanel } from './InfoSheetPanel';

const SUPPORT_EMAIL = 'houanni1314@gmail.com';

const SECTIONS = [
  { title: 'privacy_s1_title', body: 'privacy_s1_body' },
  { title: 'privacy_s2_title', body: 'privacy_s2_body' },
  { title: 'privacy_s3_title', body: 'privacy_s3_body' },
  { title: 'privacy_s4_title', body: 'privacy_s4_body' },
  { title: 'privacy_s5_title', body: 'privacy_s5_body' },
  { title: 'privacy_s6_title', body: 'privacy_s6_body' },
  { title: 'privacy_s7_title', body: 'privacy_s7_body' },
  { title: 'privacy_s8_title', body: 'privacy_s8_body' },
];

interface Props {
  onClose: () => void;
}

export const PrivacyPolicyPanel: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <InfoSheetPanel title={t('privacy_sheet_title')} onClose={onClose}>
      <p className="mb-1 text-xs text-slate-400">{t('privacy_updated')}</p>
      <p className="mb-6 text-sm leading-relaxed text-slate-500">{t('privacy_intro')}</p>

      <div className="space-y-5">
        {SECTIONS.map(s => (
          <div key={s.title}>
            <h3 className="mb-1.5 text-sm font-semibold text-slate-700">{t(s.title)}</h3>
            <div className="space-y-1">
              {t(s.body)
                .split('\n')
                .map((line, i) =>
                  line.trim() === '' ? (
                    <div key={i} className="h-1" />
                  ) : (
                    <p key={i} className="text-sm leading-relaxed text-slate-500">
                      {line}
                    </p>
                  )
                )}
            </div>
          </div>
        ))}

        <div>
          <h3 className="mb-1.5 text-sm font-semibold text-slate-700">{t('privacy_s9_title')}</h3>
          <p className="text-sm leading-relaxed text-slate-500">
            {t('privacy_s9_body')}{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-[#5F7A63] underline-offset-2 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </div>

      <div className="h-8" />
    </InfoSheetPanel>
  );
};

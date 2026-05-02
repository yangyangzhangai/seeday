// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React from 'react';
import { useTranslation } from 'react-i18next';
import { InfoSheetPanel } from './InfoSheetPanel';

const SUPPORT_EMAIL = 'hello@seedayapp.com';

const SECTIONS = [
  { title: 'terms_s1_title', body: 'terms_s1_body' },
  { title: 'terms_s2_title', body: 'terms_s2_body' },
  { title: 'terms_s3_title', body: 'terms_s3_body' },
  { title: 'terms_s4_title', body: 'terms_s4_body' },
  { title: 'terms_s5_title', body: 'terms_s5_body' },
  { title: 'terms_s6_title', body: 'terms_s6_body' },
  { title: 'terms_s7_title', body: 'terms_s7_body' },
  { title: 'terms_s8_title', body: 'terms_s8_body' },
  { title: 'terms_s9_title', body: 'terms_s9_body' },
  { title: 'terms_s10_title', body: 'terms_s10_body' },
  { title: 'terms_s11_title', body: 'terms_s11_body' },
];

interface Props {
  onClose: () => void;
}

export const TermsPanel: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();

  return (
    <InfoSheetPanel title={t('terms_sheet_title')} onClose={onClose}>
      <p className="mb-1 text-xs text-slate-400">{t('terms_updated')}</p>
      <p className="mb-6 text-sm leading-relaxed text-slate-500">{t('terms_intro')}</p>

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
          <h3 className="mb-1.5 text-sm font-semibold text-slate-700">{t('terms_s12_title')}</h3>
          <div className="space-y-1">
            {t('terms_s12_body').split('\n').map((line, i) => {
              if (line.trim() === '') return <div key={i} className="h-1" />;
              if (!line.includes(SUPPORT_EMAIL)) {
                return <p key={i} className="text-sm leading-relaxed text-slate-500">{line}</p>;
              }
              const [before, after] = line.split(SUPPORT_EMAIL);
              return (
                <p key={i} className="text-sm leading-relaxed text-slate-500">
                  {before}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#5F7A63] underline-offset-2 hover:underline">
                    {SUPPORT_EMAIL}
                  </a>
                  {after}
                </p>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 112px)' }} />
    </InfoSheetPanel>
  );
};

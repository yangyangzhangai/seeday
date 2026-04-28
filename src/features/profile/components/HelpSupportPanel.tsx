// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { InfoSheetPanel } from './InfoSheetPanel';
import { FeedbackPanel } from './FeedbackPanel';

const SUPPORT_EMAIL = 'hello@seedayapp.com';

interface QAItem {
  q: string;
  a: string;
}

interface Section {
  titleKey: string;
  items: QAItem[];
}

const SECTIONS: Section[] = [
  {
    titleKey: 'help_sec_start',
    items: [
      { q: 'help_q1', a: 'help_a1' },
      { q: 'help_q2', a: 'help_a2' },
    ],
  },
  {
    titleKey: 'help_sec_chat',
    items: [
      { q: 'help_q3', a: 'help_a3' },
      { q: 'help_q4', a: 'help_a4' },
    ],
  },
  {
    titleKey: 'help_sec_growth',
    items: [
      { q: 'help_q5', a: 'help_a5' },
      { q: 'help_q6', a: 'help_a6' },
    ],
  },
  {
    titleKey: 'help_sec_report',
    items: [{ q: 'help_q7', a: 'help_a7' }],
  },
  {
    titleKey: 'help_sec_membership',
    items: [
      { q: 'help_q8', a: 'help_a8' },
      { q: 'help_q9', a: 'help_a9' },
    ],
  },
  {
    titleKey: 'help_sec_account',
    items: [{ q: 'help_q10', a: 'help_a10' }],
  },
];

interface Props {
  onClose: () => void;
}

export const HelpSupportPanel: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const [showFeedback, setShowFeedback] = useState(false);

  if (showFeedback) {
    return <FeedbackPanel onClose={() => setShowFeedback(false)} />;
  }

  return (
    <InfoSheetPanel title={t('help_sheet_title')} onClose={onClose}>
      <p className="mb-5 text-sm text-slate-500">{t('help_intro')}</p>

      <div className="space-y-5">
        {SECTIONS.map(section => (
          <div key={section.titleKey}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5F7A63]">
              {t(section.titleKey)}
            </h3>
            <div className="overflow-hidden rounded-2xl border border-white/65 bg-white/70 [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.75),0_4px_12px_rgba(148,163,184,0.08)]">
              {section.items.map((item, idx) => (
                <React.Fragment key={item.q}>
                  {idx > 0 && <div className="mx-4 border-t border-slate-200/60" />}
                  <FAQItem question={t(item.q)} answer={t(item.a)} />
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowFeedback(true)}
        className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-[#5F7A63] transition hover:opacity-90"
        style={{
          background: 'rgba(144,212,122,0.22)',
          border: '1px solid rgba(143,175,146,0.45)',
          boxShadow: '0px 2px 2px #C8C8C8',
        }}
      >
        {t('feedback_sheet_title')}
      </button>

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 112px)' }} />
    </InfoSheetPanel>
  );
};

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/70"
      >
        <span className="pr-4 text-sm font-medium text-slate-700">{question}</span>
        <ChevronDown
          size={16}
          strokeWidth={2.5}
          className={`shrink-0 text-[#5F7A63] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="px-4 pb-3 text-sm leading-relaxed text-slate-500">{answer}</p>
      )}
    </div>
  );
};

// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import { InfoSheetPanel } from './InfoSheetPanel';
import { useAuthStore } from '../../../store/useAuthStore';
import { submitFeedback } from '../../../services/feedback/submitFeedback';

const ISSUE_TYPES = [
  'feedback_type_bug',
  'feedback_type_account',
  'feedback_type_subscription',
  'feedback_type_feature',
  'feedback_type_data',
  'feedback_type_other',
] as const;

interface Props {
  onClose: () => void;
}

export const FeedbackPanel: React.FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);

  const [email, setEmail] = useState(user?.email ?? '');
  const [subject, setSubject] = useState('');
  const [issueType, setIssueType] = useState('');
  const [desc, setDesc] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !subject.trim() || !issueType || !desc.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setLoading(true);
    try {
      await submitFeedback({
        userId: user?.id ?? '',
        email: email.trim(),
        subject: subject.trim(),
        issueType,
        description: desc.trim(),
      });
      setSubmitted(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <InfoSheetPanel title={t('feedback_sheet_title')} onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 size={48} strokeWidth={1.5} className="mb-4 text-[#5F7A63]" />
          <h2 className="mb-2 text-base font-semibold text-slate-800">{t('feedback_success_title')}</h2>
          <p className="mb-8 text-sm leading-relaxed text-slate-500">{t('feedback_success_body')}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-8 py-3 text-sm font-semibold text-[#5F7A63] transition hover:opacity-90"
            style={{
              background: 'rgba(144,212,122,0.22)',
              border: '1px solid rgba(143,175,146,0.45)',
              boxShadow: '0px 2px 2px #C8C8C8',
            }}
          >
            {t('feedback_success_close')}
          </button>
        </div>
      </InfoSheetPanel>
    );
  }

  return (
    <InfoSheetPanel title={t('feedback_sheet_title')} onClose={onClose}>
      <p className="mb-5 text-sm leading-relaxed text-slate-500">{t('feedback_intro')}</p>

      <div className="space-y-4">
        {/* Email */}
        <Field label={t('feedback_email_label')} required>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('feedback_email_placeholder')}
            className={inputCls(error && !email.trim())}
          />
        </Field>

        {/* Subject */}
        <Field label={t('feedback_subject_label')} required>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={t('feedback_subject_placeholder')}
            className={inputCls(error && !subject.trim())}
          />
        </Field>

        {/* Issue type dropdown */}
        <Field label={t('feedback_type_label')} required>
          <div className="relative">
            <button
              type="button"
              onClick={() => setTypeOpen(v => !v)}
              className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm transition ${
                error && !issueType
                  ? 'border-red-300 bg-red-50/60'
                  : 'border-[#8FAF92]/40 bg-white/85'
              }`}
            >
              <span className={issueType ? 'text-slate-800' : 'text-slate-400'}>
                {issueType ? t(issueType as (typeof ISSUE_TYPES)[number]) : t('feedback_type_placeholder')}
              </span>
              <ChevronDown
                size={16}
                strokeWidth={2}
                className={`text-slate-400 transition-transform ${typeOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {typeOpen && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-lg">
                {ISSUE_TYPES.map((key, i) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setIssueType(key); setTypeOpen(false); }}
                    className={`flex w-full px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-[#F0F4F1] ${
                      i < ISSUE_TYPES.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        {/* Description */}
        <Field label={t('feedback_desc_label')} required>
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder={t('feedback_desc_placeholder')}
            rows={5}
            className={`${inputCls(error && !desc.trim())} resize-none leading-relaxed`}
          />
        </Field>

        {/* Error hint */}
        {error && (
          <p className="text-xs text-red-500">{t('feedback_required')}</p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold text-[#5F7A63] transition hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'rgba(144,212,122,0.22)',
            border: '1px solid rgba(143,175,146,0.45)',
            boxShadow: '0px 2px 2px #C8C8C8',
          }}
        >
          {loading ? '...' : t('feedback_submit')}
        </button>
      </div>

      <div className="h-8" />
    </InfoSheetPanel>
  );
};

const inputCls = (hasError: boolean) =>
  `w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-shadow ${
    hasError
      ? 'border-red-300 bg-red-50/60 focus:ring-2 focus:ring-red-200'
      : 'border-[#8FAF92]/40 bg-white/85 focus:border-[#8FAF92]/70 focus:ring-2 focus:ring-[#8FAF92]/25'
  }`;

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1 text-sm font-medium text-slate-700">
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

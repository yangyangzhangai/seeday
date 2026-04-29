// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../api/supabase';
import { TelemetryPageShell } from './TelemetryPageShell';

interface FeedbackRow {
  id: string;
  email: string;
  subject: string;
  issue_type: string;
  description: string;
  created_at: string;
}

const ISSUE_TYPE_ICONS: Record<string, string> = {
  feedback_type_bug: '🐛',
  feedback_type_account: '👤',
  feedback_type_subscription: '💳',
  feedback_type_feature: '✨',
  feedback_type_data: '📦',
  feedback_type_other: '💬',
};

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export const FeedbackTelemetryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('user_feedback')
        .select('id, email, subject, issue_type, description, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (err) {
        setError(err.message);
      } else {
        setRows((data as FeedbackRow[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const typeCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.issue_type] = (acc[r.issue_type] ?? 0) + 1;
    return acc;
  }, {});

  const issueTypeLabel = (issueType: string) => {
    const icon = ISSUE_TYPE_ICONS[issueType] ?? '💬';
    return `${icon} ${t(issueType)}`;
  };

  return (
    <TelemetryPageShell backTo="/telemetry" maxWidthClass="max-w-4xl">

        {/* Header */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">{t('telemetry_feedback_title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('telemetry_feedback_desc')}</p>
          <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">{t('telemetry_feedback_reading_guide')}</p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t('telemetry_feedback_total')} value={rows.length} hint={t('telemetry_feedback_total_hint')} />
          {Object.entries(typeCounts).map(([key, count]) => (
            <StatCard key={key} label={issueTypeLabel(key)} value={count} hint={t('telemetry_feedback_type_hint')} />
          ))}
        </section>

        {/* Table */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_feedback_list_title')}</h2>
          </div>

          {loading && (
            <p className="px-4 py-6 text-sm text-gray-400">{t('telemetry_feedback_loading')}</p>
          )}
          {error && (
            <p className="px-4 py-6 text-sm text-red-500">{error}</p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400">{t('telemetry_feedback_empty')}</p>
          )}

          {!loading && rows.map((row) => (
            <div
              key={row.id}
              className="border-b border-gray-50 last:border-0"
            >
              <button
                type="button"
                onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {issueTypeLabel(row.issue_type)}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-800">{row.subject}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span>{row.email}</span>
                    <span>·</span>
                    <span>{formatDate(row.created_at, i18n.language || 'en-US')}</span>
                  </div>
                </div>
                <span className="mt-1 shrink-0 text-xs text-gray-400">{expanded === row.id ? '▲' : '▼'}</span>
              </button>

              {expanded === row.id && (
                <div className="border-t border-gray-50 bg-gray-50/60 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{row.description}</p>
                </div>
              )}
            </div>
          ))}
        </section>

    </TelemetryPageShell>
  );
};

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

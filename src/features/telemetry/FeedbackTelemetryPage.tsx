// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../api/supabase';

interface FeedbackRow {
  id: string;
  email: string;
  subject: string;
  issue_type: string;
  description: string;
  created_at: string;
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  feedback_type_bug: '🐛 Bug',
  feedback_type_account: '👤 账号',
  feedback_type_subscription: '💳 订阅',
  feedback_type_feature: '✨ 功能建议',
  feedback_type_data: '📦 数据',
  feedback_type_other: '💬 其他',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export const FeedbackTelemetryPage: React.FC = () => {
  const { t } = useTranslation();
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

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-4">

        {/* Header */}
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">{t('telemetry_feedback_title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('telemetry_feedback_desc')}</p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t('telemetry_feedback_total')} value={rows.length} />
          {Object.entries(typeCounts).map(([key, count]) => (
            <StatCard key={key} label={ISSUE_TYPE_LABELS[key] ?? key} value={count} />
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
                      {ISSUE_TYPE_LABELS[row.issue_type] ?? row.issue_type}
                    </span>
                    <span className="truncate text-sm font-medium text-gray-800">{row.subject}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <span>{row.email}</span>
                    <span>·</span>
                    <span>{formatDate(row.created_at)}</span>
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

      </div>
    </div>
  );
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

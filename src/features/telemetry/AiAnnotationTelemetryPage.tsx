// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callLiveInputTelemetryDashboardAPI } from '../../api/client';
import type {
  AnnotationScoreBucketItem,
  LiveInputTelemetryBreakdownItem,
  LiveInputTelemetryDashboardResponse,
} from '../../services/input/liveInputTelemetryApi';
import { TelemetryPageShell } from './TelemetryPageShell';

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function BreakdownSection(props: {
  title: string;
  description: string;
  items: LiveInputTelemetryBreakdownItem[];
  emptyLabel: string;
}) {
  const { title, description, items, emptyLabel } = props;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="break-all text-gray-700">{item.key}</span>
              <span className="shrink-0 text-gray-500">{item.count} / {formatPercent(item.percent)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BucketTable({ items }: { items: AnnotationScoreBucketItem[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{t('telemetry_ai_bucket_empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="py-2 font-medium">{t('telemetry_ai_table_bucket')}</th>
              <th className="py-2 font-medium">{t('telemetry_ai_table_samples')}</th>
              <th className="py-2 font-medium">{t('telemetry_ai_table_triggered')}</th>
              <th className="py-2 font-medium">{t('telemetry_ai_table_trigger_rate')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key} className="border-b border-gray-50 last:border-b-0">
              <td className="py-2 text-gray-700">{item.key}</td>
              <td className="py-2 text-gray-700">{item.count}</td>
              <td className="py-2 text-gray-700">{item.triggeredCount}</td>
              <td className="py-2 text-gray-700">{formatPercent(item.triggerRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const AiAnnotationTelemetryPage: React.FC = () => {
  const { t } = useTranslation();
  const [days, setDays] = useState(14);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<LiveInputTelemetryDashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await callLiveInputTelemetryDashboardAPI(days);
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('telemetry_ai_load_failed'));
          setDashboard(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [days, t]);

  const summary = dashboard?.aiAnnotationSummary;

  return (
    <TelemetryPageShell backTo="/telemetry">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('telemetry_ai_title')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('telemetry_ai_desc')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 14, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    value === days ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t('telemetry_common_days', { n: value })}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
            {t('telemetry_ai_decision_hint')}
          </p>
        </section>

        {isLoading ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
            {t('telemetry_ai_loading')}
          </section>
        ) : null}

        {!isLoading && error ? (
          <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">{error}</p>
          </section>
        ) : null}

        {!isLoading && !error && summary ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('telemetry_ai_summary_trigger_rate')}</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{formatPercent(summary.lateralTriggerRate)}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('telemetry_ai_summary_samples')}</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{summary.lateralSampledCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('telemetry_ai_summary_event_triggered')}</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{summary.eventTriggeredCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('telemetry_ai_summary_avg_score')}</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{summary.avgNarrativeScore.toFixed(3)}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">{t('telemetry_ai_summary_avg_probability')}</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{formatPercent(summary.avgFinalProbability)}</div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_ai_bucket_title')}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {t('telemetry_ai_bucket_desc')}
              </p>
              <div className="mt-3">
                <BucketTable items={dashboard.narrativeScoreBuckets} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <BreakdownSection
                title={t('telemetry_ai_breakdown_event_mix')}
                description={t('telemetry_ai_breakdown_event_mix_desc')}
                items={dashboard.annotationEventNames}
                emptyLabel={t('telemetry_ai_breakdown_event_mix_empty')}
              />
              <BreakdownSection
                title={t('telemetry_ai_breakdown_by_character')}
                description={t('telemetry_ai_breakdown_by_character_desc')}
                items={dashboard.annotationCharacters}
                emptyLabel={t('telemetry_ai_breakdown_by_character_empty')}
              />
              <BreakdownSection
                title={t('telemetry_ai_breakdown_association_types')}
                description={t('telemetry_ai_breakdown_association_types_desc')}
                items={dashboard.associationTypes}
                emptyLabel={t('telemetry_ai_breakdown_association_types_empty')}
              />
            </section>
          </>
        ) : null}
    </TelemetryPageShell>
  );
};

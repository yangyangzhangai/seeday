// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callLiveInputTelemetryDashboardAPI } from '../../api/client';
import type {
  LiveInputTelemetryBreakdownItem,
  LiveInputTelemetryDashboardResponse,
  LiveInputTelemetryRecentEvent,
  TodoDecomposeTelemetrySeriesPoint,
} from '../../services/input/liveInputTelemetryApi';

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function MetricCard(props: {
  title: string;
  value: string;
  whatItMeans: string;
  businessMeaning: string;
  howToUse: string;
}) {
  const { t } = useTranslation();
  const { title, value, whatItMeans, businessMeaning, howToUse } = props;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
      <p className="mt-2 text-xs text-gray-500"><span className="font-semibold text-gray-600">{t('telemetry_todo_metric_label_what')}:</span> {whatItMeans}</p>
      <p className="mt-1 text-xs text-gray-500"><span className="font-semibold text-gray-600">{t('telemetry_todo_metric_label_business')}:</span> {businessMeaning}</p>
      <p className="mt-1 text-xs text-gray-500"><span className="font-semibold text-gray-600">{t('telemetry_todo_metric_label_action')}:</span> {howToUse}</p>
    </section>
  );
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

function SeriesTable({ items }: { items: TodoDecomposeTelemetrySeriesPoint[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{t('telemetry_todo_daily_empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
              <th className="py-2 font-medium">{t('telemetry_todo_table_day')}</th>
              <th className="py-2 font-medium">{t('telemetry_todo_table_requested')}</th>
              <th className="py-2 font-medium">{t('telemetry_todo_table_succeeded')}</th>
              <th className="py-2 font-medium">{t('telemetry_todo_table_empty')}</th>
              <th className="py-2 font-medium">{t('telemetry_todo_table_parse_failed')}</th>
              <th className="py-2 font-medium">{t('telemetry_todo_table_failed')}</th>
              <th className="py-2 font-medium">{t('telemetry_todo_table_regenerate')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.day} className="border-b border-gray-50 last:border-b-0">
              <td className="py-2 text-gray-700">{item.day}</td>
              <td className="py-2 text-gray-700">{item.requestedCount}</td>
              <td className="py-2 text-gray-700">{item.succeededCount}</td>
              <td className="py-2 text-gray-700">{item.emptyCount}</td>
              <td className="py-2 text-gray-700">{item.parseFailedCount}</td>
              <td className="py-2 text-gray-700">{item.failedCount}</td>
              <td className="py-2 text-gray-700">{item.regenerateCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentEvents({ items }: { items: LiveInputTelemetryRecentEvent[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{t('telemetry_todo_recent_empty')}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{item.createdAt}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.eventName || t('telemetry_common_unknown')}</span>
            {item.lang ? <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.lang}</span> : null}
            {item.model ? <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.model}</span> : null}
            {typeof item.isRegenerate === 'boolean' ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{t('telemetry_todo_recent_regen')}: {item.isRegenerate ? t('telemetry_common_yes') : t('telemetry_common_no')}</span>
            ) : null}
            {typeof item.stepsCount === 'number' ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{t('telemetry_todo_recent_steps')}: {item.stepsCount}</span>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-gray-500">{t('telemetry_todo_recent_todo')}: {item.todoId || t('telemetry_common_unknown')} / {t('telemetry_live_recent_user')}: {item.userId}</div>
        </div>
      ))}
    </div>
  );
}

export const TodoDecomposeTelemetryPage: React.FC = () => {
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
          setError(loadError instanceof Error ? loadError.message : t('telemetry_todo_load_failed'));
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

  const summary = dashboard?.todoDecomposeSummary;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('telemetry_todo_title')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('telemetry_todo_desc')}
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
            {t('telemetry_todo_reading_guide')}
          </p>
        </section>

        {isLoading ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
            {t('telemetry_todo_loading')}
          </section>
        ) : null}

        {!isLoading && error ? (
          <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">{error}</p>
          </section>
        ) : null}

        {!isLoading && !error && summary ? (
          <>
            <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              <MetricCard
                title={t('telemetry_todo_metric_empty_rate_title')}
                value={formatPercent(summary.emptyRate)}
                whatItMeans={t('telemetry_todo_metric_empty_rate_what')}
                businessMeaning={t('telemetry_todo_metric_empty_rate_business')}
                howToUse={t('telemetry_todo_metric_empty_rate_action')}
              />
              <MetricCard
                title={t('telemetry_todo_metric_parse_rate_title')}
                value={formatPercent(summary.parseFailureRate)}
                whatItMeans={t('telemetry_todo_metric_parse_rate_what')}
                businessMeaning={t('telemetry_todo_metric_parse_rate_business')}
                howToUse={t('telemetry_todo_metric_parse_rate_action')}
              />
              <MetricCard
                title={t('telemetry_todo_metric_regenerate_rate_title')}
                value={formatPercent(summary.regenerateRate)}
                whatItMeans={t('telemetry_todo_metric_regenerate_rate_what')}
                businessMeaning={t('telemetry_todo_metric_regenerate_rate_business')}
                howToUse={t('telemetry_todo_metric_regenerate_rate_action')}
              />
            </section>

            <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <MetricCard
                title={t('telemetry_todo_metric_requested_title')}
                value={String(summary.requestedCount)}
                whatItMeans={t('telemetry_todo_metric_requested_what')}
                businessMeaning={t('telemetry_todo_metric_requested_business')}
                howToUse={t('telemetry_todo_metric_requested_action')}
              />
              <MetricCard
                title={t('telemetry_todo_metric_succeeded_title')}
                value={String(summary.succeededCount)}
                whatItMeans={t('telemetry_todo_metric_succeeded_what')}
                businessMeaning={t('telemetry_todo_metric_succeeded_business')}
                howToUse={t('telemetry_todo_metric_succeeded_action')}
              />
              <MetricCard
                title={t('telemetry_todo_metric_failed_title')}
                value={`${summary.failedCount} (${formatPercent(summary.failureRate)})`}
                whatItMeans={t('telemetry_todo_metric_failed_what')}
                businessMeaning={t('telemetry_todo_metric_failed_business')}
                howToUse={t('telemetry_todo_metric_failed_action')}
              />
              <MetricCard
                title={t('telemetry_todo_metric_avg_steps_title')}
                value={summary.avgStepsPerSuccess.toFixed(2)}
                whatItMeans={t('telemetry_todo_metric_avg_steps_what')}
                businessMeaning={t('telemetry_todo_metric_avg_steps_business')}
                howToUse={t('telemetry_todo_metric_avg_steps_action')}
              />
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_todo_daily_title')}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {t('telemetry_todo_daily_desc')}
              </p>
              <div className="mt-3">
                <SeriesTable items={dashboard.todoDecomposeSeries} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <BreakdownSection
                title={t('telemetry_todo_breakdown_event_mix')}
                description={t('telemetry_todo_breakdown_event_mix_desc')}
                items={dashboard.todoDecomposeEventNames}
                emptyLabel={t('telemetry_todo_breakdown_event_mix_empty')}
              />
              <BreakdownSection
                title={t('telemetry_todo_breakdown_by_language')}
                description={t('telemetry_todo_breakdown_by_language_desc')}
                items={dashboard.todoDecomposeByLang}
                emptyLabel={t('telemetry_todo_breakdown_by_language_empty')}
              />
              <BreakdownSection
                title={t('telemetry_todo_breakdown_by_model')}
                description={t('telemetry_todo_breakdown_by_model_desc')}
                items={dashboard.todoDecomposeByModel}
                emptyLabel={t('telemetry_todo_breakdown_by_model_empty')}
              />
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_todo_recent_title')}</h2>
              <p className="mt-1 text-xs text-gray-500">
                {t('telemetry_todo_recent_desc')}
              </p>
              <div className="mt-3">
                <RecentEvents items={dashboard.todoDecomposeRecentEvents} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

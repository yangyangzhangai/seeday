// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
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
  const { title, value, whatItMeans, businessMeaning, howToUse } = props;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
      <p className="mt-2 text-xs text-gray-500"><span className="font-semibold text-gray-600">What:</span> {whatItMeans}</p>
      <p className="mt-1 text-xs text-gray-500"><span className="font-semibold text-gray-600">Business:</span> {businessMeaning}</p>
      <p className="mt-1 text-xs text-gray-500"><span className="font-semibold text-gray-600">Action:</span> {howToUse}</p>
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
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No daily trend data yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="py-2 font-medium">Day</th>
            <th className="py-2 font-medium">Requested</th>
            <th className="py-2 font-medium">Succeeded</th>
            <th className="py-2 font-medium">Empty</th>
            <th className="py-2 font-medium">Parse Failed</th>
            <th className="py-2 font-medium">Failed</th>
            <th className="py-2 font-medium">Regenerate</th>
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
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No todo-decompose telemetry events yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{item.createdAt}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.eventName || 'unknown'}</span>
            {item.lang ? <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.lang}</span> : null}
            {item.model ? <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.model}</span> : null}
            {typeof item.isRegenerate === 'boolean' ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">regen: {item.isRegenerate ? 'yes' : 'no'}</span>
            ) : null}
            {typeof item.stepsCount === 'number' ? (
              <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">steps: {item.stepsCount}</span>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-gray-500">todo: {item.todoId || 'unknown'} / user: {item.userId}</div>
        </div>
      ))}
    </div>
  );
}

export const TodoDecomposeTelemetryPage: React.FC = () => {
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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load todo decompose telemetry dashboard.');
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
  }, [days]);

  const summary = dashboard?.todoDecomposeSummary;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Todo Decompose Telemetry</h1>
              <p className="mt-1 text-sm text-gray-500">
                Product-facing quality board for AI todo breakdown. Every metric includes plain-language meaning and
                optimization hints so PMs can make decisions without reading code.
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
                  {value}d
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">
            Reading guide: prioritize <code>parse failure rate</code> and <code>empty rate</code> first (quality), then
            monitor <code>regenerate rate</code> (user friction) for model and prompt tuning.
          </p>
        </section>

        {isLoading ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading todo decompose telemetry...
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
                title="Empty Step Rate"
                value={formatPercent(summary.emptyRate)}
                whatItMeans="Among successful decompose responses, how often we got zero usable steps."
                businessMeaning="High value means users click but still cannot start work, so trust drops."
                howToUse="If this rises, tighten prompt specificity and verify language/model quality by breakdowns below."
              />
              <MetricCard
                title="Parse Failure Rate"
                value={formatPercent(summary.parseFailureRate)}
                whatItMeans="How often model output could not be parsed into expected JSON."
                businessMeaning="High value means technical reliability issues and invisible user frustration."
                howToUse="If above baseline, lower output complexity, reduce temperature, and compare model variants."
              />
              <MetricCard
                title="Regenerate Rate"
                value={formatPercent(summary.regenerateRate)}
                whatItMeans="How often users re-run decomposition after already getting a first decomposition."
                businessMeaning="High value suggests first result quality is not actionable enough."
                howToUse="Review top languages/models with high regenerate behavior and improve prompt examples."
              />
            </section>

            <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <MetricCard
                title="Requested"
                value={String(summary.requestedCount)}
                whatItMeans="Total clicks on decompose action (first run + regenerate)."
                businessMeaning="Shows feature demand and adoption."
                howToUse="Use with success/failure rates; growth with bad quality means compounding frustration."
              />
              <MetricCard
                title="Succeeded"
                value={String(summary.succeededCount)}
                whatItMeans="Requests that produced at least one usable sub-step."
                businessMeaning="Core success volume that can convert to task completion."
                howToUse="Track after prompt/model changes; should increase while empty/failure rates drop."
              />
              <MetricCard
                title="Failed"
                value={`${summary.failedCount} (${formatPercent(summary.failureRate)})`}
                whatItMeans="Request-level failures (network/service/runtime) during decomposition."
                businessMeaning="Represents hard blockers where user cannot continue at all."
                howToUse="If this spikes, inspect provider status and API errors before prompt tuning."
              />
              <MetricCard
                title="Avg Steps / Success"
                value={summary.avgStepsPerSuccess.toFixed(2)}
                whatItMeans="Average number of steps generated when decomposition succeeds."
                businessMeaning="Too low may be vague; too high may create overload."
                howToUse="Target a practical range (usually 3-6) and balance with regenerate rate."
              />
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Daily Trend</h2>
              <p className="mt-1 text-xs text-gray-500">
                Track quality over time. A healthy trend is: requested stable/increasing, while parse-failed/empty/failed stay flat or decline.
              </p>
              <div className="mt-3">
                <SeriesTable items={dashboard.todoDecomposeSeries} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <BreakdownSection
                title="Event Mix"
                description="Distribution of todo-decompose event stages; useful for funnel diagnosis."
                items={dashboard.todoDecomposeEventNames}
                emptyLabel="No todo-decompose events yet."
              />
              <BreakdownSection
                title="By Language"
                description="Compare quality behavior across zh/en/it to decide language-specific model strategy."
                items={dashboard.todoDecomposeByLang}
                emptyLabel="No language signals yet."
              />
              <BreakdownSection
                title="By Model"
                description="Observe which model variants are producing more empty/failed/retry behavior."
                items={dashboard.todoDecomposeByModel}
                emptyLabel="No model usage signals yet."
              />
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Recent Todo Decompose Events</h2>
              <p className="mt-1 text-xs text-gray-500">
                Use this for concrete QA examples: find bad cases quickly, then replay with the same language/model settings.
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

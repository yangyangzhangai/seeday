// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
import { callLiveInputTelemetryDashboardAPI } from '../../api/client';
import type {
  AnnotationScoreBucketItem,
  LiveInputTelemetryBreakdownItem,
  LiveInputTelemetryDashboardResponse,
} from '../../services/input/liveInputTelemetryApi';

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
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No narrative score buckets yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="py-2 font-medium">Score Bucket</th>
            <th className="py-2 font-medium">Samples</th>
            <th className="py-2 font-medium">Triggered</th>
            <th className="py-2 font-medium">Trigger Rate</th>
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
          setError(loadError instanceof Error ? loadError.message : 'Failed to load AI annotation telemetry dashboard.');
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

  const summary = dashboard?.aiAnnotationSummary;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">AI Annotation Telemetry</h1>
              <p className="mt-1 text-sm text-gray-500">
                This board tracks low-narrative scoring, lateral-association sampling, event triggering, and
                downstream condensation.
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
            Decision hint: if lateral trigger rate is persistently above 65%, reduce base probability; if below 35%,
            raise base probability or increase probability delta.
          </p>
        </section>

        {isLoading ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
            Loading AI annotation telemetry...
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
                <div className="text-xs uppercase tracking-wide text-gray-400">Lateral Trigger Rate</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{formatPercent(summary.lateralTriggerRate)}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">Lateral Samples</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{summary.lateralSampledCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">Event Triggered</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{summary.eventTriggeredCount}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">Avg Narrative Score</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{summary.avgNarrativeScore.toFixed(3)}</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">Avg Final Probability</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{formatPercent(summary.avgFinalProbability)}</div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">Narrative Score Buckets</h2>
              <p className="mt-1 text-xs text-gray-500">
                What it means: each bucket groups low-density scores. Lower buckets should generally show higher
                lateral trigger rate after probability modulation.
              </p>
              <div className="mt-3">
                <BucketTable items={dashboard.narrativeScoreBuckets} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <BreakdownSection
                title="Annotation Event Mix"
                description="What happened in the annotation pipeline and where requests are blocked or converted."
                items={dashboard.annotationEventNames}
                emptyLabel="No annotation telemetry events yet."
              />
              <BreakdownSection
                title="By Character"
                description="How lateral sampling distributes across companion characters for balancing and QA."
                items={dashboard.annotationCharacters}
                emptyLabel="No character-level events yet."
              />
              <BreakdownSection
                title="Association Types"
                description="Which lateral association dimensions are being sampled in production."
                items={dashboard.associationTypes}
                emptyLabel="No association type events yet."
              />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

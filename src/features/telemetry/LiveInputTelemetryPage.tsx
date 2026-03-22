import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { callLiveInputTelemetryDashboardAPI } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  LiveInputTelemetryBreakdownItem,
  LiveInputTelemetryDashboardResponse,
  LiveInputTelemetryRecentEvent,
  LiveInputTelemetrySeriesPoint,
} from '../../services/input/liveInputTelemetryApi';

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function isLikelyAdmin(user: any): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  const roleCandidates = [
    user?.app_metadata?.role,
    user?.user_metadata?.role,
    ...(Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : []),
    ...(Array.isArray(user?.user_metadata?.roles) ? user.user_metadata.roles : []),
  ];

  return roleCandidates.some((item) => (
    typeof item === 'string'
    && ['admin', 'owner', 'staff', 'internal', 'super_admin'].includes(item.trim().toLowerCase())
  ));
}

function BreakdownSection(props: {
  title: string;
  items: LiveInputTelemetryBreakdownItem[];
  emptyLabel: string;
}) {
  const { title, items, emptyLabel } = props;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{emptyLabel}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-700 break-all">{item.key}</span>
              <span className="shrink-0 text-gray-500">{item.count} / {formatPercent(item.percent)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SeriesTable({ items }: { items: LiveInputTelemetrySeriesPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="py-2 font-medium">Day</th>
            <th className="py-2 font-medium">Classifications</th>
            <th className="py-2 font-medium">Corrections</th>
            <th className="py-2 font-medium">Users</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.day} className="border-b border-gray-50 last:border-b-0">
              <td className="py-2 text-gray-700">{item.day}</td>
              <td className="py-2 text-gray-700">{item.classificationCount}</td>
              <td className="py-2 text-gray-700">{item.correctionCount}</td>
              <td className="py-2 text-gray-700">{item.uniqueUsers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentEvents({ items }: { items: LiveInputTelemetryRecentEvent[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No recent telemetry events yet.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{item.createdAt}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.eventType}</span>
            {item.lang ? <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.lang}</span> : null}
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">len {item.inputLength}</span>
          </div>
          <div className="mt-2 text-sm text-gray-800 break-all">
            {item.eventType === 'classification'
              ? `${item.internalKind || 'unknown'} / ${item.confidence || 'unknown'}`
              : `${item.fromKind || 'unknown'} -> ${item.toKind || 'unknown'}`}
          </div>
          {item.reasons && item.reasons.length > 0 ? (
            <div className="mt-2 text-xs text-gray-500 break-all">{item.reasons.join(', ')}</div>
          ) : null}
          {item.inputPreview ? (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2 text-xs text-gray-600">{item.inputPreview}</pre>
          ) : null}
          <div className="mt-2 text-[11px] text-gray-400">user {item.userId}</div>
        </div>
      ))}
    </div>
  );
}

export const LiveInputTelemetryPage: React.FC = () => {
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [days, setDays] = useState(14);
  const [dashboard, setDashboard] = useState<LiveInputTelemetryDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const next = await callLiveInputTelemetryDashboardAPI(days);
        if (!cancelled) {
          setDashboard(next);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load live input telemetry.');
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
  }, [days, user]);

  if (loading || !user) {
    return null;
  }

  const likelyAdmin = isLikelyAdmin(user);

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Live Input Telemetry</h1>
              <p className="mt-1 text-sm text-gray-500">
                Authenticated classification and correction events from real users, aggregated from Supabase.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 14, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    value === days
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {value}d
                </button>
              ))}
            </div>
          </div>

          {!likelyAdmin ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Current client metadata does not look like an admin account. If this page returns 403 in production,
              add your email to <code>LIVE_INPUT_ADMIN_EMAILS</code> or set an admin role in Supabase Auth metadata.
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
            Loading telemetry dashboard...
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <p className="mt-2 text-sm text-gray-500">
              This page needs the new Supabase table plus server env vars like <code>SUPABASE_SERVICE_ROLE_KEY</code>
              and <code>LIVE_INPUT_ADMIN_EMAILS</code>.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && dashboard ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Classifications</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{dashboard.summary.classificationCount}</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Corrections</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{dashboard.summary.correctionCount}</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Correction Rate</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{formatPercent(dashboard.summary.correctionRate)}</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs uppercase tracking-wide text-gray-400">Unique Users</div>
                <div className="mt-2 text-3xl font-semibold text-gray-900">{dashboard.summary.uniqueUsers}</div>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900">Daily Series</h2>
              <div className="mt-3">
                <SeriesTable items={dashboard.series} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BreakdownSection
                title="By Internal Kind"
                items={dashboard.byInternalKind}
                emptyLabel="No classification events in this window."
              />
              <BreakdownSection
                title="Correction Paths"
                items={dashboard.correctionPaths}
                emptyLabel="No correction events in this window."
              />
              <BreakdownSection
                title="Top Reasons"
                items={dashboard.topReasons}
                emptyLabel="No reason codes yet."
              />
              <BreakdownSection
                title="By Language"
                items={dashboard.byLang}
                emptyLabel="No language distribution yet."
              />
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Events</h2>
              <div className="mt-3">
                <RecentEvents items={dashboard.recentEvents} />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};

// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callProfileSettingsTelemetryDashboardAPI } from '../../api/client';
import type {
  ProfileSettingsTelemetryBreakdownItem,
  ProfileSettingsTelemetryDashboardResponse,
  ProfileSettingsTelemetryRecentEvent,
  ProfileSettingsTelemetrySeriesPoint,
} from '../../types/profileSettingsTelemetry';

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function StatCard(props: { title: string; value: string | number; hint: string }) {
  const { title, value, hint } = props;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
      <p className="mt-2 text-xs text-gray-500">{hint}</p>
    </section>
  );
}

function BreakdownSection(props: {
  title: string;
  description: string;
  items: ProfileSettingsTelemetryBreakdownItem[];
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

function SeriesTable({ items }: { items: ProfileSettingsTelemetrySeriesPoint[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{t('telemetry_profile_series_empty')}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-gray-500">
            <th className="py-2 font-medium">{t('telemetry_profile_table_day')}</th>
            <th className="py-2 font-medium">{t('telemetry_profile_table_open')}</th>
            <th className="py-2 font-medium">{t('telemetry_profile_table_change')}</th>
            <th className="py-2 font-medium">{t('telemetry_profile_table_reset')}</th>
            <th className="py-2 font-medium">{t('telemetry_profile_table_save')}</th>
            <th className="py-2 font-medium">{t('telemetry_profile_table_fail')}</th>
            <th className="py-2 font-medium">{t('telemetry_profile_table_users')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.day} className="border-b border-gray-50 last:border-b-0">
              <td className="py-2 text-gray-700">{item.day}</td>
              <td className="py-2 text-gray-700">{item.openedCount}</td>
              <td className="py-2 text-gray-700">{item.changedCount}</td>
              <td className="py-2 text-gray-700">{item.resetCount}</td>
              <td className="py-2 text-gray-700">{item.savedCount}</td>
              <td className="py-2 text-gray-700">{item.saveFailedCount}</td>
              <td className="py-2 text-gray-700">{item.uniqueUsers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentEvents({ items }: { items: ProfileSettingsTelemetryRecentEvent[] }) {
  const { t } = useTranslation();
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{t('telemetry_profile_recent_empty')}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{item.createdAt}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.eventName}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{t('telemetry_profile_recent_user')} {item.userId}</span>
          </div>
          {item.slotIndex !== null ? (
            <div className="mt-2 text-sm text-gray-800">
              {t('telemetry_profile_recent_slot')} {item.slotIndex} / {t('telemetry_profile_recent_from')} {item.from ?? t('telemetry_common_na')} / {t('telemetry_profile_recent_to')} {item.to ?? t('telemetry_common_na')}
            </div>
          ) : null}
          {item.order.length > 0 ? (
            <div className="mt-2 text-xs text-gray-500 break-all">{t('telemetry_profile_recent_order')}: {item.order.join(' > ')}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export const ProfileSettingsTelemetryPage: React.FC = () => {
  const { t } = useTranslation();
  const [days, setDays] = useState(14);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<ProfileSettingsTelemetryDashboardResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await callProfileSettingsTelemetryDashboardAPI(days);
        if (!cancelled) setDashboard(data);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : t('telemetry_profile_load_failed'));
          setDashboard(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [days, t]);

  const summary = dashboard?.summary;

  return (
    <div className="h-full overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('telemetry_profile_title')}</h1>
              <p className="mt-1 text-sm text-gray-500">{t('telemetry_profile_desc')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[7, 14, 30].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDays(value)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${value === days ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {t('telemetry_common_days', { n: value })}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">{t('telemetry_profile_reading_guide')}</p>
        </section>

        {isLoading ? (
          <section className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm">
            {t('telemetry_profile_loading')}
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
              <StatCard title={t('telemetry_profile_summary_open')} value={summary.openedCount} hint={t('telemetry_profile_summary_open_hint')} />
              <StatCard title={t('telemetry_profile_summary_save_rate')} value={formatPercent(summary.saveSuccessRate)} hint={t('telemetry_profile_summary_save_rate_hint')} />
              <StatCard title={t('telemetry_profile_summary_users')} value={summary.uniqueUsers} hint={t('telemetry_profile_summary_users_hint')} />
              <StatCard title={t('telemetry_profile_summary_savers')} value={summary.usersWhoSaved} hint={t('telemetry_profile_summary_savers_hint')} />
              <StatCard title={t('telemetry_profile_summary_avg_changes')} value={summary.avgChangesPerSave.toFixed(2)} hint={t('telemetry_profile_summary_avg_changes_hint')} />
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_profile_series_title')}</h2>
              <p className="mt-1 text-xs text-gray-500">{t('telemetry_profile_series_desc')}</p>
              <div className="mt-3">
                <SeriesTable items={dashboard.series} />
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <BreakdownSection
                title={t('telemetry_profile_breakdown_events')}
                description={t('telemetry_profile_breakdown_events_desc')}
                items={dashboard.eventNames}
                emptyLabel={t('telemetry_profile_breakdown_events_empty')}
              />
              <BreakdownSection
                title={t('telemetry_profile_breakdown_slots')}
                description={t('telemetry_profile_breakdown_slots_desc')}
                items={dashboard.changedSlots}
                emptyLabel={t('telemetry_profile_breakdown_slots_empty')}
              />
              <BreakdownSection
                title={t('telemetry_profile_breakdown_orders')}
                description={t('telemetry_profile_breakdown_orders_desc')}
                items={dashboard.savedOrders}
                emptyLabel={t('telemetry_profile_breakdown_orders_empty')}
              />
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_profile_recent_title')}</h2>
              <p className="mt-1 text-xs text-gray-500">{t('telemetry_profile_recent_desc')}</p>
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

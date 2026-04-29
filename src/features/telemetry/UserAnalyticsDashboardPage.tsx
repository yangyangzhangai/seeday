// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { callUserAnalyticsDashboardAPI, callUserAnalyticsLookupAPI } from '../../api/client';
import type {
  UserAnalyticsDashboardResponse,
  UserAnalyticsDailySeries,
  UserAnalyticsRetentionRow,
  UserAnalyticsLookupResult,
} from '../../types/userAnalytics';
import { TelemetryPageShell } from './TelemetryPageShell';

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function StatCard({ label, value, sub, hint }: { label: string; value: string | number; sub?: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function DailyTable({ rows }: { rows: UserAnalyticsDailySeries[] }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{t('ua_daily_series')}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="py-2 font-medium">{t('ua_day')}</th>
              <th className="py-2 font-medium">{t('ua_new_users')}</th>
              <th className="py-2 font-medium">{t('ua_dau')}</th>
              <th className="py-2 font-medium">{t('ua_new_premium')}</th>
              <th className="py-2 font-medium">{t('ua_active_premium')}</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.day} className="border-b border-gray-50 last:border-b-0">
                <td className="py-1.5 text-gray-700">{r.day}</td>
                <td className="py-1.5 text-gray-700">{r.newUsers}</td>
                <td className="py-1.5 font-medium text-gray-900">{r.dau}</td>
                <td className="py-1.5 text-indigo-600">{r.newPremium}</td>
                <td className="py-1.5 text-indigo-600">{r.activePremium}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RetentionTable({ rows }: { rows: UserAnalyticsRetentionRow[] }) {
  const { t } = useTranslation();
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">{t('ua_retention_title')}</h2>
        <p className="mt-3 text-sm text-gray-500">{t('ua_retention_empty')}</p>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{t('ua_retention_title')}</h2>
      <p className="mt-1 text-xs text-gray-500">{t('ua_retention_desc')}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="py-2 font-medium">{t('ua_cohort_week')}</th>
              <th className="py-2 font-medium">{t('ua_new_users')}</th>
              <th className="py-2 font-medium">{t('ua_retained_d7')}</th>
              <th className="py-2 font-medium">{t('ua_d7_rate')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohortWeek} className="border-b border-gray-50 last:border-b-0">
                <td className="py-1.5 text-gray-700">{r.cohortWeek}</td>
                <td className="py-1.5 text-gray-700">{r.cohortSize}</td>
                <td className="py-1.5 text-gray-700">{r.d7Retained}</td>
                <td className={`py-1.5 font-medium ${r.d7RetentionRate >= 0.3 ? 'text-green-600' : r.d7RetentionRate >= 0.1 ? 'text-yellow-600' : 'text-red-500'}`}>
                  {pct(r.d7RetentionRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserLookupPanel() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UserAnalyticsLookupResult | null | undefined>(undefined);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const resp = await callUserAnalyticsLookupAPI(query.trim());
      setResult(resp.found ? resp.user : null);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const premiumLabel = result
    ? result.isPremium
      ? t('ua_field_premium_yes', { plan: result.membershipPlan ?? t('ua_field_plan_unknown') })
      : t('ua_field_premium_no')
    : '';

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{t('ua_lookup_title')}</h2>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={t('ua_lookup_placeholder')}
          className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '...' : t('ua_lookup_search')}
        </button>
      </div>

      {result === null && (
        <p className="mt-3 text-sm text-gray-500">{t('ua_lookup_not_found', { query })}</p>
      )}

      {result && (
        <div className="mt-4 space-y-1.5 text-sm">
          <Row label={t('ua_field_id')} value={result.id} />
          <Row label={t('ua_field_email')} value={result.email} />
          <Row label={t('ua_field_registered')} value={new Date(result.createdAt).toLocaleString()} />
          <Row label={t('ua_field_premium')} value={premiumLabel} />
          <Row label={t('ua_field_messages')} value={result.totalMessages} />
          <Row label={t('ua_field_focus')} value={result.totalFocusSessions} />
          <Row label={t('ua_field_streak')} value={result.loginStreak ?? 'N/A'} />
          <Row
            label={t('ua_field_last_active')}
            value={result.lastMessageAt ? new Date(result.lastMessageAt).toLocaleString() : t('ua_field_never')}
          />
        </div>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 break-all text-right">{value}</span>
    </div>
  );
}

export function UserAnalyticsDashboardPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<UserAnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    callUserAnalyticsDashboardAPI(days)
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [days]);

  const ov = data?.overview;

  return (
    <TelemetryPageShell backTo="/telemetry" maxWidthClass="max-w-4xl">
        <section className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{t('ua_title')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('ua_desc')}</p>
            {data && (
              <p className="mt-0.5 text-xs text-gray-400">
                {t('ua_updated')} {new Date(data.generatedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-sm outline-none"
            >
              <option value={7}>{t('ua_days_7')}</option>
              <option value={14}>{t('ua_days_14')}</option>
              <option value={30}>{t('ua_days_30')}</option>
              <option value={60}>{t('ua_days_60')}</option>
            </select>
          </div>
        </section>

        {loading && <p className="py-8 text-center text-sm text-gray-400">{t('ua_loading')}</p>}
        {error && <p className="py-8 text-center text-sm text-red-500">{error}</p>}

        {ov && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label={t('ua_total_users')} value={ov.totalUsers} hint={t('ua_hint_total_users')} />
            <StatCard
              label={t('ua_total_premium')}
              value={ov.totalPremium}
              sub={`${t('ua_conversion')} ${pct(ov.conversionRate)}`}
              hint={t('ua_hint_total_premium')}
            />
            <StatCard
              label={t('ua_active_today')}
              value={ov.activeToday}
              sub={t('ua_premium_sub', { n: ov.activePremiumToday })}
              hint={t('ua_hint_active_today')}
            />
            <StatCard
              label={t('ua_new_today')}
              value={ov.newToday}
              sub={t('ua_premium_sub', { n: ov.newPremiumToday })}
              hint={t('ua_hint_new_today')}
            />
          </div>
        )}

        {data && <DailyTable rows={data.dailySeries} />}
        {data && <RetentionTable rows={data.retention} />}

        <UserLookupPanel />
    </TelemetryPageShell>
  );
}

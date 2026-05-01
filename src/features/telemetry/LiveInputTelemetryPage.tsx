import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { callLiveInputTelemetryDashboardAPI } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  LiveInputTelemetryBreakdownItem,
  LiveInputTelemetryDashboardResponse,
  LiveInputTelemetryRecentEvent,
  LiveInputTelemetrySeriesPoint,
} from '../../services/input/liveInputTelemetryApi';
import { isTelemetryAdmin } from './isTelemetryAdmin';
import { TelemetryPageShell } from './TelemetryPageShell';

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
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

function MetricCard(props: {
  title: string;
  value: string;
  hint: string;
}) {
  const { title, value, hint } = props;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">{value}</div>
      <p className="mt-2 text-xs text-gray-500">{hint}</p>
    </section>
  );
}

function getReasonTagCount(items: LiveInputTelemetryBreakdownItem[], prefix: string): LiveInputTelemetryBreakdownItem[] {
  const total = items
    .filter((item) => item.key.startsWith(prefix))
    .reduce((sum, item) => sum + item.count, 0);
  if (total <= 0) {
    return [];
  }

  return items
    .filter((item) => item.key.startsWith(prefix))
    .map((item) => ({
      key: item.key.slice(prefix.length),
      count: item.count,
      percent: item.count / total,
    }))
    .sort((left, right) => right.count - left.count);
}

function SeriesTable({ items }: { items: LiveInputTelemetrySeriesPoint[] }) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="py-2 font-medium">{t('telemetry_live_table_day')}</th>
            <th className="py-2 font-medium">{t('telemetry_live_table_classifications')}</th>
            <th className="py-2 font-medium">{t('telemetry_live_table_corrections')}</th>
            <th className="py-2 font-medium">{t('telemetry_live_table_plant_assets')}</th>
            <th className="py-2 font-medium">{t('telemetry_live_table_diary_stickers')}</th>
            <th className="py-2 font-medium">{t('telemetry_live_table_users')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.day} className="border-b border-gray-50 last:border-b-0">
              <td className="py-2 text-gray-700">{item.day}</td>
              <td className="py-2 text-gray-700">{item.classificationCount}</td>
              <td className="py-2 text-gray-700">{item.correctionCount}</td>
              <td className="py-2 text-gray-700">{item.plantAssetCount}</td>
              <td className="py-2 text-gray-700">{item.diaryStickerCount}</td>
              <td className="py-2 text-gray-700">{item.uniqueUsers}</td>
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
    return <p className="text-sm text-gray-500">{t('telemetry_live_recent_empty')}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{item.createdAt}</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.eventType}</span>
            {item.lang ? <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{item.lang}</span> : null}
            <span className="rounded-full bg-white px-2 py-0.5 text-gray-600">{t('telemetry_live_recent_len', { n: item.inputLength })}</span>
          </div>
          <div className="mt-2 text-sm text-gray-800 break-all">
            {item.eventType === 'classification'
              ? `${item.internalKind || t('telemetry_common_unknown')} / ${item.confidence || t('telemetry_common_unknown')}`
              : item.eventType === 'correction'
                ? `${item.fromKind || t('telemetry_common_unknown')} -> ${item.toKind || t('telemetry_common_unknown')}`
                : item.eventType === 'annotation_telemetry'
                  ? `${item.eventName || t('telemetry_live_recent_annotation_event')} / ${t('telemetry_live_recent_score')} ${item.narrativeScore?.toFixed(3) || t('telemetry_common_na')}`
                : item.eventType === 'diary_sticker'
                  ? `${item.eventName || t('telemetry_live_recent_diary_sticker_unknown')} / ${item.stickerId || t('telemetry_live_recent_all')}`
                : `${t('telemetry_live_recent_fallback')} L${item.fallbackLevel || 4} / ${item.rootType || t('telemetry_common_unknown')}_${item.plantStage || t('telemetry_common_unknown')}`}
          </div>
          {item.eventType === 'diary_sticker' ? (
            <div className="mt-2 text-xs text-gray-500 break-all">
              {t('telemetry_live_recent_report')}: {item.reportId || t('telemetry_common_unknown')} / {t('telemetry_live_recent_date')}: {item.reportDate || t('telemetry_common_unknown')}
              {item.newOrder && item.newOrder.length > 0 ? ` / ${t('telemetry_live_recent_order')}: ${item.newOrder.join(' > ')}` : ''}
            </div>
          ) : null}
          {item.eventType === 'plant_asset' ? (
            <div className="mt-2 text-xs text-gray-500 break-all">
              {t('telemetry_live_recent_request')}: {item.requestedPlantId || t('telemetry_common_unknown')}
            </div>
          ) : null}
          {item.reasons && item.reasons.length > 0 ? (
            <div className="mt-2 text-xs text-gray-500 break-all">{item.reasons.join(', ')}</div>
          ) : null}
          {item.inputPreview ? (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-2 text-xs text-gray-600">{item.inputPreview}</pre>
          ) : null}
          <div className="mt-2 text-[11px] text-gray-400">{t('telemetry_live_recent_user')} {item.userId}</div>
        </div>
      ))}
    </div>
  );
}

export const LiveInputTelemetryPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [dashboard, setDashboard] = useState<LiveInputTelemetryDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [module, setModule] = useState<'classification' | 'tagging' | 'plant' | 'mixed'>('classification');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/onboarding');
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
          setError(fetchError instanceof Error ? fetchError.message : t('telemetry_live_load_failed'));
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
  }, [days, t, user]);

  if (loading || !user) {
    return null;
  }

  const likelyAdmin = isTelemetryAdmin(user);
  const userPlanBreakdown = dashboard ? getReasonTagCount(dashboard.topReasons, 'user_plan:') : [];
  const classificationPathBreakdown = dashboard ? getReasonTagCount(dashboard.topReasons, 'classification_path:') : [];
  const aiCalledBreakdown = dashboard ? getReasonTagCount(dashboard.topReasons, 'ai_called:') : [];
  const bottleSourceBreakdown = dashboard ? getReasonTagCount(dashboard.topReasons, 'bottle_match_source:') : [];

  return (
    <TelemetryPageShell backTo="/telemetry">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{t('telemetry_live_title')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('telemetry_live_desc')} <code>telemetry_events</code>.
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
                  {t('telemetry_common_days', { n: value })}
                </button>
              ))}
            </div>
          </div>

          {!likelyAdmin ? (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {t('telemetry_live_admin_hint')} <code>LIVE_INPUT_ADMIN_EMAILS</code> {t('telemetry_live_admin_hint_suffix')}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-sm text-gray-500">
            {t('telemetry_live_loading')}
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <p className="mt-2 text-sm text-gray-500">
              {t('telemetry_live_error_hint')}{' '}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> and <code>LIVE_INPUT_ADMIN_EMAILS</code>.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && dashboard ? (
          <>
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_live_modules_title')}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['classification', 'tagging', 'plant', 'mixed'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setModule(value)}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${
                      value === module
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t(`telemetry_live_module_${value}`)}
                  </button>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                title={t('telemetry_live_summary_classifications')}
                value={String(dashboard.summary.classificationCount)}
                hint={t('telemetry_live_hint_classifications')}
              />
              <MetricCard
                title={t('telemetry_live_summary_corrections')}
                value={String(dashboard.summary.correctionCount)}
                hint={t('telemetry_live_hint_corrections')}
              />
              <MetricCard
                title={t('telemetry_live_summary_correction_rate')}
                value={formatPercent(dashboard.summary.correctionRate)}
                hint={t('telemetry_live_hint_correction_rate')}
              />
              <MetricCard
                title={t('telemetry_live_summary_unique_users')}
                value={String(dashboard.summary.uniqueUsers)}
                hint={t('telemetry_live_hint_unique_users')}
              />
              <MetricCard
                title={t('telemetry_live_summary_plant_assets')}
                value={`${dashboard.summary.plantAssetCount} / ${formatPercent(dashboard.summary.plantExactHitRate)}`}
                hint={t('telemetry_live_hint_plant_assets')}
              />
              <MetricCard
                title={t('telemetry_live_summary_diary_stickers')}
                value={String(dashboard.summary.diaryStickerCount)}
                hint={t('telemetry_live_hint_diary_stickers')}
              />
              <MetricCard
                title={t('telemetry_live_summary_bottle_linked')}
                value={String(dashboard.summary.bottleLinkedCount)}
                hint={t('telemetry_live_hint_bottle_linked')}
              />
              <MetricCard
                title={t('telemetry_live_summary_plant_generate')}
                value={`${dashboard.summary.plantGenerateSucceededCount} / ${dashboard.summary.plantGenerateFailedCount}`}
                hint={t('telemetry_live_hint_plant_generate')}
              />
            </section>

            {module === 'classification' ? (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_live_module_classification')}</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <BreakdownSection
                  title={t('telemetry_live_breakdown_kind')}
                  items={dashboard.byKind}
                  emptyLabel={t('telemetry_live_breakdown_kind_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_breakdown_confidence')}
                  items={dashboard.byConfidence}
                  emptyLabel={t('telemetry_live_breakdown_confidence_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_breakdown_internal_kind')}
                  items={dashboard.byInternalKind}
                  emptyLabel={t('telemetry_live_breakdown_internal_kind_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_breakdown_correction_paths')}
                  items={dashboard.correctionPaths}
                  emptyLabel={t('telemetry_live_breakdown_correction_paths_empty')}
                />
              </div>
            </section>
            ) : null}

            {module === 'tagging' ? (
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_live_membership_title')}</h2>
              <p className="mt-1 text-xs text-gray-500">{t('telemetry_live_membership_desc')}</p>
              <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <BreakdownSection
                  title={t('telemetry_live_membership_user_plan')}
                  items={userPlanBreakdown}
                  emptyLabel={t('telemetry_live_membership_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_membership_classification_path')}
                  items={classificationPathBreakdown}
                  emptyLabel={t('telemetry_live_membership_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_membership_ai_called')}
                  items={aiCalledBreakdown}
                  emptyLabel={t('telemetry_live_membership_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_membership_bottle_source')}
                  items={bottleSourceBreakdown}
                  emptyLabel={t('telemetry_live_membership_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_breakdown_bottle_link_source')}
                  items={dashboard.bottleLinkedSources}
                  emptyLabel={t('telemetry_live_breakdown_bottle_link_source_empty')}
                />
                <BreakdownSection
                  title={t('telemetry_live_breakdown_bottle_link_target')}
                  items={dashboard.bottleLinkedTargets}
                  emptyLabel={t('telemetry_live_breakdown_bottle_link_target_empty')}
                />
              </div>
            </section>
            ) : null}

            {module === 'plant' ? (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BreakdownSection
                title={t('telemetry_live_breakdown_plant_fallback')}
                items={dashboard.plantFallbackLevels}
                emptyLabel={t('telemetry_live_breakdown_plant_fallback_empty')}
              />
              <BreakdownSection
                title={t('telemetry_live_breakdown_plant_generate_actions')}
                items={dashboard.plantGenerateActions}
                emptyLabel={t('telemetry_live_breakdown_plant_generate_actions_empty')}
              />
            </section>
            ) : null}

            {module === 'mixed' ? (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BreakdownSection
                title={t('telemetry_live_breakdown_top_reasons')}
                items={dashboard.topReasons}
                emptyLabel={t('telemetry_live_breakdown_top_reasons_empty')}
              />
              <BreakdownSection
                title={t('telemetry_live_breakdown_by_language')}
                items={dashboard.byLang}
                emptyLabel={t('telemetry_live_breakdown_by_language_empty')}
              />
              <BreakdownSection
                title={t('telemetry_live_breakdown_diary_actions')}
                items={dashboard.diaryStickerActions}
                emptyLabel={t('telemetry_live_breakdown_diary_actions_empty')}
              />
            </section>
            ) : null}

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_live_daily_series')}</h2>
              <div className="mt-3">
                <SeriesTable items={dashboard.series} />
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-900">{t('telemetry_live_recent_events')}</h2>
              <div className="mt-3">
                <RecentEvents items={dashboard.recentEvents} />
              </div>
            </section>
          </>
        ) : null}
    </TelemetryPageShell>
  );
};

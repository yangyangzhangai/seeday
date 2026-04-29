// DOC-DEPS: src/features/report/README.md, docs/PROJECT_MAP.md, docs/CURRENT_TASK.md
import React from 'react';
import { format, isSameDay } from 'date-fns';
import { enUS, it as itLocale, zhCN } from 'date-fns/locale';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Report } from '../../store/useReportStore';
import { cn } from '../../lib/utils';
import { APP_MODAL_CARD_CLASS, APP_MODAL_CLOSE_CLASS, APP_MODAL_OVERLAY_CLASS } from '../../lib/modalTheme';
import type { DailyPlantRecord } from '../../types/plant';
import { PlantImage } from './plant/PlantImage';

type PageData = {
  type: 'cover' | 'day-left' | 'day-right' | 'blank' | 'back';
  dayNum?: number;
  date?: Date;
  report?: Report;
};

export type ExpandTarget = { side: 'left' | 'right'; page: PageData } | null;

export function DiaryBookViewerExpandedView({
  target,
  onClose,
  plantRecords,
}: {
  target: ExpandTarget;
  onClose: () => void;
  plantRecords: DailyPlantRecord[];
}) {
  const { t, i18n } = useTranslation();
  if (!target) return null;
  const { side, page } = target;
  const { date, report } = page;
  const dayPlant = date ? plantRecords.find((p) => p.date === format(date, 'yyyy-MM-dd')) : null;
  const lang = i18n.language?.split('-')[0] ?? 'en';
  const dateLocale = lang === 'zh' ? zhCN : lang === 'it' ? itLocale : enUS;
  const datePattern = lang === 'zh' ? 'yyyy年M月d日 EEEE' : 'EEEE, MMMM d, yyyy';

  return (
    <div
      className={cn('fixed inset-0 z-[200] flex items-end', APP_MODAL_OVERLAY_CLASS)}
      onClick={onClose}
    >
      <div
        className={cn(APP_MODAL_CARD_CLASS, 'w-full max-h-[88vh] rounded-t-3xl overflow-y-auto')}
        style={{ padding: '20px 20px 48px', boxSizing: 'border-box' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span className="text-base font-bold" style={{ color: '#4a3a2a' }}>
            {date && format(date, datePattern, { locale: dateLocale })}
          </span>
          <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')} style={{ cursor: 'pointer' }}>
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>

        {side === 'left' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              {dayPlant ? (
                <PlantImage
                  plantId={dayPlant.plantId}
                  rootType={dayPlant.rootType}
                  plantStage={dayPlant.plantStage}
                  imgClassName="max-h-40 max-w-full object-contain"
                />
              ) : (
                <span style={{ fontSize: 36, opacity: 0.18 }}>🌱</span>
              )}
            </div>

            <div>
              <div className="text-sm font-bold" style={{ color: '#3d5a8a', marginBottom: 10 }}>{t('diary_expanded_ai_observation')}</div>
              {report?.aiAnalysis ? (
                <p className="text-sm" style={{ margin: 0, color: '#4a5a7a', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{report.aiAnalysis}</p>
              ) : (
                <p className="text-sm" style={{ margin: 0, color: 'rgba(61,90,138,0.4)', fontStyle: 'italic' }}>
                  {report ? t('diary_expanded_ai_pending') : t('diary_expanded_ai_empty')}
                </p>
              )}
            </div>

            {!report && (
              <div className="text-sm text-center" style={{ color: 'rgba(0,0,0,0.3)', padding: '24px 0' }}>
                {date && isSameDay(date, new Date()) ? t('diary_expanded_today_after_8') : t('diary_expanded_no_diary')}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {report?.stats?.actionSummary && (
              <div>
                <div className="text-xs font-bold" style={{ color: '#4a3a2a', marginBottom: 6 }}>{t('diary_expanded_activity')}</div>
                <p className="text-sm" style={{ margin: 0, color: '#5a4a3a', lineHeight: 1.65 }}>{report.stats.actionSummary}</p>
              </div>
            )}
            {report?.stats?.moodSummary && (
              <div>
                <div className="text-xs font-bold" style={{ color: '#4a3a2a', marginBottom: 6 }}>{t('diary_expanded_mood')}</div>
                <p className="text-sm" style={{ margin: 0, color: '#7a6a5a', lineHeight: 1.65 }}>{report.stats.moodSummary}</p>
              </div>
            )}

            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />

            <div>
              <div className="text-sm font-bold" style={{ color: '#4a3a2a', marginBottom: 10 }}>{t('diary_expanded_my_diary')}</div>
              {report?.userNote ? (
                <p className="text-sm" style={{ margin: 0, color: '#4a3a2a', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{report.userNote}</p>
              ) : (
                <p className="text-sm" style={{ margin: 0, color: 'rgba(0,0,0,0.2)', lineHeight: '28px' }}>
                  {report ? t('diary_expanded_no_note') : t('diary_expanded_no_diary')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import type { Locale } from 'date-fns';
import { endOfMonth, format, isSameDay, isSunday } from 'date-fns';
import { X } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useTranslation } from 'react-i18next';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_OVERLAY_CLASS,
} from '../../lib/modalTheme';
import { cn } from '../../lib/utils';
import { isFutureDiaryDate } from './reportPageHelpers';

type CalendarValuePiece = Date | null;
export type ReportCalendarValue = CalendarValuePiece | [CalendarValuePiece, CalendarValuePiece];

interface ReportCalendarModalProps {
  value: ReportCalendarValue;
  today: Date;
  locale: string;
  dateLocale: Locale;
  notice: string | null;
  onChange: (value: ReportCalendarValue) => void;
  onClickDay: (value: Date) => void;
  onClose: () => void;
  onFeatureNotice: (kind: 'weekly' | 'monthly' | 'custom') => void;
}

export function ReportCalendarModal({
  value,
  today,
  locale,
  dateLocale,
  notice,
  onChange,
  onClickDay,
  onClose,
  onFeatureNotice,
}: ReportCalendarModalProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center p-6', APP_MODAL_OVERLAY_CLASS)}
      onClick={onClose}
    >
      <div
        className={cn(APP_MODAL_CARD_CLASS, 'w-full max-w-xs rounded-[34px] p-4 animate-in fade-in zoom-in-95')}
        style={{
          background: 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(255,255,255,0.82)',
          boxShadow: '0 24px 54px rgba(40,56,44,0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
          backdropFilter: 'blur(18px) saturate(130%)',
          WebkitBackdropFilter: 'blur(18px) saturate(130%)',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">{t('report_calendar_view')}</span>
          <button onClick={onClose} className={cn(APP_MODAL_CLOSE_CLASS, 'p-1')}>
            <X size={24} strokeWidth={1.5} />
          </button>
        </div>
        <div className="calendar-wrapper report-calendar-frost relative flex justify-center">
          {notice ? (
            <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 px-1 py-0.5 text-center text-[12px] font-medium text-[#4a5d4c]">
              {notice}
            </div>
          ) : null}
          <Calendar
            onChange={nextValue => onChange(nextValue as ReportCalendarValue)}
            value={value}
            onClickDay={onClickDay}
            tileDisabled={({ date, view }) => (
              view === 'month' && (isSameDay(date, today) || isFutureDiaryDate(date, today))
            )}
            locale={locale}
            className="w-full border-none text-[13px] font-medium"
            showNeighboringMonth={false}
            formatDay={(_, date) => String(date.getDate())}
            formatShortWeekday={(_, date) => format(date, 'EEEEE', { locale: dateLocale })}
            tileContent={({ date, view }) => {
              if (view !== 'month') return null;
              const sunday = isSunday(date);
              const monthEnd = date.getDate() === endOfMonth(date).getDate();
              if (!sunday && !monthEnd) return null;
              return (
                <div className="pointer-events-auto absolute inset-x-0 bottom-[1px] flex items-center justify-center gap-1">
                  {sunday ? (
                    <button
                      type="button"
                      onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onFeatureNotice('weekly');
                      }}
                      className="calendar-tag-hit calendar-tag-hit--weekly"
                      aria-label={t('report_weekly_coming_soon')}
                      title={t('report_weekly_coming_soon')}
                    />
                  ) : null}
                  {monthEnd ? (
                    <button
                      type="button"
                      onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onFeatureNotice('monthly');
                      }}
                      className="calendar-tag-hit calendar-tag-hit--monthly"
                      aria-label={t('report_monthly_coming_soon')}
                      title={t('report_monthly_coming_soon')}
                    />
                  ) : null}
                </div>
              );
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[11px] font-medium text-[#4a5d4c]">
          {(['weekly', 'monthly', 'custom'] as const).map(kind => (
            <button
              key={kind}
              type="button"
              className="flex items-center gap-1.5"
              onClick={() => onFeatureNotice(kind)}
            >
              <span className={`calendar-tag-dot calendar-tag-dot--${kind}`} />
              <span>{t(`report_${kind}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

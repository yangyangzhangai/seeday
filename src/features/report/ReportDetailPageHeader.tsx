// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  APP_GLASS_BUTTON_BASE_STYLE,
  APP_GREEN_GLASS_BUTTON_STYLE,
  APP_GREEN_GLASS_TEXT,
  APP_MODAL_CLOSE_CLASS,
} from '../../lib/modalTheme';

interface ReportDetailPageHeaderProps {
  activePage: 0 | 1;
  date: string;
  onBack?: () => void;
  onClose?: () => void;
  onOpenCalendar?: () => void;
  onOpenDiaryBook?: () => void;
  calendarLabel?: string;
  diaryBookLabel?: string;
  isPrimaryPage?: boolean;
  onNextDate?: () => void;
  title: string;
}

const iconButtonClass = `${APP_MODAL_CLOSE_CLASS} flex h-11 w-11 items-center justify-center p-0`;
const iconButtonStyle = { ...APP_GLASS_BUTTON_BASE_STYLE, color: '#1A1A1A' };

export function ReportDetailPageHeader({
  activePage,
  date,
  onBack,
  onClose,
  onOpenCalendar,
  onOpenDiaryBook,
  calendarLabel,
  diaryBookLabel,
  isPrimaryPage = false,
  onNextDate,
  title,
}: ReportDetailPageHeaderProps) {
  return (
    <header className="flex-shrink-0">
      <div className="relative flex h-12 items-center justify-between px-4">
        {!isPrimaryPage ? (
          <button className={iconButtonClass} onClick={onBack} style={iconButtonStyle}>
            <ChevronLeft size={24} strokeWidth={1.5} />
          </button>
        ) : null}
        <h2 className={isPrimaryPage
          ? 'pointer-events-none absolute left-1/2 -translate-x-1/2 text-2xl font-bold text-[#1A1A1A] max-[410px]:left-4 max-[410px]:translate-x-0'
          : 'text-2xl font-bold text-[#1A1A1A]'}
        >
          {title}
        </h2>
        {isPrimaryPage ? (
          <div className="ml-auto flex items-center gap-2">
            <button
              className="flex h-11 w-11 items-center justify-center rounded-2xl p-0 transition-all hover:scale-105 active:scale-95"
              onClick={onOpenCalendar}
              style={APP_GREEN_GLASS_BUTTON_STYLE}
              aria-label={calendarLabel}
              title={calendarLabel}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 24, color: APP_GREEN_GLASS_TEXT }}
              >
                calendar_month
              </span>
            </button>
            <button
              className="flex h-11 items-center gap-2 rounded-2xl px-5 transition-all hover:scale-105 active:scale-95"
              onClick={onOpenDiaryBook}
              style={{ ...APP_GREEN_GLASS_BUTTON_STYLE, color: APP_GREEN_GLASS_TEXT }}
              aria-label={diaryBookLabel}
              title={diaryBookLabel}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20 }}
              >
                book_5
              </span>
              <span className="text-[13px] font-bold">{diaryBookLabel}</span>
            </button>
          </div>
        ) : (
          <button
            className={iconButtonClass}
            onClick={onNextDate ?? onClose}
            style={iconButtonStyle}
          >
            {onNextDate ? <ChevronRight size={24} strokeWidth={1.5} /> : <X size={22} strokeWidth={1.5} />}
          </button>
        )}
      </div>

      <div className="px-4 pt-3">
        <h1
          className="mb-2 text-center text-sm font-medium text-[#1A1A1A]"
          style={{ fontFamily: 'Abhaya Libre, serif' }}
        >
          {date}
        </h1>
        <div className="border-t-[0.5px] border-[#AEAABF]" />
        <div className="flex h-8 items-center justify-center">
          <div className="flex items-center gap-2" aria-hidden="true">
            {[0, 1].map((page) => (
              <span
                key={page}
                className="h-2 w-2 rounded-full"
                style={{
                  background: activePage === page ? '#1A1A1A' : 'transparent',
                  border: `1px solid ${activePage === page ? '#1A1A1A' : '#AEAABF'}`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

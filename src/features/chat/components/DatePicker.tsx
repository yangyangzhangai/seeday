// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { toLocalDateStr } from '../../../lib/dateUtils';
import { cn } from '../../../lib/utils';

export interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function getDaysInMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const blanks: null[] = Array(first).fill(null);
  const days = Array.from({ length: count }, (_, i) => new Date(year, month, i + 1));
  return [...blanks, ...days];
}

export const DatePicker: React.FC<DatePickerProps> = ({ selectedDate, onDateChange }) => {
  const { i18n } = useTranslation();
  const [showMonthGrid, setShowMonthGrid] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const popupRef = useRef<HTMLDivElement>(null);

  const today       = new Date();
  const todayStr    = toLocalDateStr(today);
  const selectedStr = toLocalDateStr(selectedDate);
  const weekDates   = getWeekDates(selectedDate);
  const DAY_LABELS  = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const isFuture = (d: Date) => toLocalDateStr(d) > todayStr;

  // Close popup on outside click
  useEffect(() => {
    if (!showMonthGrid) return;
    const handle = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowMonthGrid(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMonthGrid]);

  const handleDayClick = useCallback((d: Date) => {
    if (isFuture(d)) return;
    onDateChange(d);
    setShowMonthGrid(false);
  }, [onDateChange, todayStr]); // eslint-disable-line

  const monthTitle = currentMonth.toLocaleDateString(i18n.language, {
    month: 'long', year: 'numeric',
  });

  const gridDays = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());

  return (
    <div className="bg-white border-b border-gray-100 px-3 pb-2 pt-1 select-none">
      {/* Month title button + compact dropdown popup */}
      <div className="relative inline-block mb-2" ref={popupRef}>
        <button
          onClick={() => {
            setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
            setShowMonthGrid(v => !v);
          }}
          className="flex items-center gap-1 text-sm font-semibold text-gray-700 px-1 py-0.5"
        >
          <span>{monthTitle}</span>
          <ChevronDown size={14} className={cn('transition-transform', showMonthGrid && 'rotate-180')} />
        </button>

        {/* Compact calendar dropdown */}
        {showMonthGrid && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-100 rounded-2xl shadow-lg w-40 p-2">
            {/* Popup header */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <ChevronLeft size={13} />
              </button>
              <span className="text-xs font-semibold text-gray-700">{monthTitle}</span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  className="p-1 rounded-lg hover:bg-gray-100"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => setShowMonthGrid(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Day-of-week labels */}
            <div className="grid grid-cols-7 gap-y-0.5 mb-0.5">
              {DAY_LABELS.map((l, i) => (
                <div key={i} className="text-center text-[9px] text-gray-400 leading-5">{l}</div>
              ))}

              {/* Day cells */}
              {gridDays.map((d, i) => {
                if (!d) return <div key={`b-${i}`} />;
                const ds     = toLocalDateStr(d);
                const future = isFuture(d);
                return (
                  <button
                    key={ds}
                    onClick={() => handleDayClick(d)}
                    disabled={future}
                    className={cn(
                      'h-5 w-5 mx-auto rounded-full text-[9px] flex items-center justify-center transition-colors',
                      ds === todayStr && ds !== selectedStr && 'text-blue-500 font-bold',
                      ds === selectedStr && 'bg-blue-500 text-white font-bold',
                      future ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100',
                    )}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Week row */}
      <div className="flex gap-0.5 overflow-x-auto">
        {weekDates.map((d) => {
          const ds     = toLocalDateStr(d);
          const future = isFuture(d);
          return (
            <button
              key={ds}
              onClick={() => handleDayClick(d)}
              disabled={future}
              className={cn(
                'flex flex-col items-center justify-center min-w-[38px] h-11 rounded-xl flex-1 transition-colors',
                ds === selectedStr ? 'bg-blue-500 text-white' : 'hover:bg-gray-50',
                future && 'opacity-40 cursor-not-allowed',
              )}
            >
              <span className="text-[9px] uppercase tracking-wide leading-none">
                {DAY_LABELS[d.getDay()]}
              </span>
              <span className={cn(
                'text-sm font-semibold leading-none mt-0.5',
                ds === todayStr && ds !== selectedStr && 'text-blue-500',
              )}>
                {d.getDate()}
              </span>
              {ds === todayStr && (
                <div className={cn('w-1 h-1 rounded-full mt-0.5', ds === selectedStr ? 'bg-white' : 'bg-blue-400')} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, startOfMonth, subMonths, isSameMonth, getDaysInMonth, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { zhCN, enUS, it as itLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Report } from '../../store/useReportStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { DiaryBookViewer } from './DiaryBookViewer';

/* ──────────────────────────── constants ──────────────────────────── */
const LEATHER_TEXTURE = 'https://images.unsplash.com/photo-1729823546609-2b113553cdcd?q=80&w=1080';
const PARCHMENT_TEXTURE = 'https://images.unsplash.com/photo-1719563015025-83946fb49e49?q=80&w=1080';

const COVER_COLORS = ['#7c4a5a', '#4d7a9e', '#8aac8d', '#3d5244', '#b56740', '#9a7a3a', '#5c5e8a', '#3d6b6d'];
const DAY_MARK_LIGHT = 'linear-gradient(160deg, rgba(228, 239, 231, 0.92), rgba(205, 223, 210, 0.88))';
const DAY_MARK_MID = 'linear-gradient(160deg, rgba(191, 212, 197, 0.92), rgba(168, 195, 177, 0.88))';
const DAY_MARK_DEEP = 'linear-gradient(160deg, rgba(120, 152, 131, 0.96), rgba(98, 131, 111, 0.94))';
const DAY_MARK_SELECTED = 'linear-gradient(165deg, #46624f, #3a5444)';

type ParsedDateInput = {
  year: number | null;
  month: number | null;
  day: number | null;
  selectedDate: Date | null;
  isValid: boolean;
};

function parseContinuousMonthDay(restDigits: string): { month: number | null; day: number | null } {
  if (!restDigits) return { month: null, day: null };
  if (restDigits.length === 1) {
    return { month: Number(restDigits), day: null };
  }
  if (restDigits.length === 2) {
    const asMonth = Number(restDigits);
    if (asMonth >= 1 && asMonth <= 12) {
      return { month: asMonth, day: null };
    }
    const month = Number(restDigits[0]);
    const dayDigit = Number(restDigits[1]);
    if (month >= 1 && month <= 9) {
      if (dayDigit === 0) {
        return { month, day: null };
      }
      return { month, day: dayDigit };
    }
    return { month: asMonth, day: null };
  }
  if (restDigits.length === 3) {
    return { month: Number(restDigits[0]), day: Number(restDigits.slice(1, 3)) };
  }
  return {
    month: Number(restDigits.slice(0, 2)),
    day: Number(restDigits.slice(2, 4)),
  };
}

function parseDateInput(rawInput: string): ParsedDateInput {
  const cleaned = rawInput.trim();
  if (!cleaned) return { year: null, month: null, day: null, selectedDate: null, isValid: false };

  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 4) return { year: null, month: null, day: null, selectedDate: null, isValid: false };

  const year = Number(digitsOnly.slice(0, 4));
  if (!Number.isFinite(year) || year < 1000 || year > 9999) {
    return { year: null, month: null, day: null, selectedDate: null, isValid: false };
  }

  const tokens = cleaned.split(/\D+/).filter(Boolean);
  let month: number | null = null;
  let day: number | null = null;

  if (tokens.length >= 2) {
    if (tokens.length === 2 && tokens[1].length >= 3) {
      const parsed = parseContinuousMonthDay(tokens[1]);
      month = parsed.month;
      day = parsed.day;
    } else {
      month = Number(tokens[1]);
    }
  }
  if (tokens.length >= 3) {
    day = Number(tokens[2]);
  }

  if (tokens.length <= 1) {
    const rest = digitsOnly.slice(4);
    const parsed = parseContinuousMonthDay(rest);
    month = parsed.month;
    day = parsed.day;
  }

  if (month != null && (!Number.isFinite(month) || month < 1 || month > 12)) {
    return { year, month, day, selectedDate: null, isValid: false };
  }

  if (month != null && day != null) {
    const maxDay = getDaysInMonth(new Date(year, month - 1, 1));
    if (!Number.isFinite(day) || day < 1 || day > maxDay) {
      return { year, month, day, selectedDate: null, isValid: false };
    }
    return {
      year,
      month,
      day,
      selectedDate: new Date(year, month - 1, day),
      isValid: true,
    };
  }

  return {
    year,
    month,
    day: null,
    selectedDate: null,
    isValid: true,
  };
}

function coverColor(month: Date): string {
  const idx = (month.getFullYear() * 12 + month.getMonth()) % COVER_COLORS.length;
  return COVER_COLORS[idx];
}

/* ──────────────────────────── month list ────────────────────────── */
function buildMonthList(firstBookMonth: Date | null): Date[] {
  if (!firstBookMonth) return [];
  const current  = startOfMonth(new Date());
  const earliest = startOfMonth(firstBookMonth);
  const list: Date[] = [];
  let cursor = new Date(current);
  while (cursor >= earliest) {
    list.push(new Date(cursor));
    cursor = subMonths(cursor, 1);
  }
  return list;
}

/* ──────────────────────────── BookThumb ────────────────────────── */
interface ThumbProps {
  month: Date;
  isSelected: boolean;
  isEditing: boolean;
  bookName: string;
  onCoverClick: () => void;
  onStartEdit: () => void;
  onNameChange: (name: string) => void;
  divRef: (el: HTMLDivElement | null) => void;
}

function BookThumb({ month, isSelected, isEditing, bookName, onCoverClick, onStartEdit, onNameChange, divRef }: ThumbProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { i18n } = useTranslation();
  const lang = i18n.language?.split('-')[0] ?? 'en';
  const locale = lang === 'zh' ? zhCN : lang === 'it' ? itLocale : enUS;
  const color = coverColor(month);
  const subtitle = format(month, lang === 'zh' ? 'yyyy · MM月' : 'yyyy · MM', { locale });

  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  return (
    <div ref={divRef} className="snap-center flex-shrink-0">
      <motion.div
        whileHover={{ y: -10, rotate: -2, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onCoverClick}
        className="relative w-[160px] cursor-pointer group/book"
        style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
      >
        {/* Book body — A5 ratio 1:1.41 */}
        <div
          className="relative overflow-hidden transition-all"
          style={{
            aspectRatio: '1/1.41',
            backgroundColor: color,
            borderRadius: '4px 12px 12px 4px',
            boxShadow: '-7px 0 10px -1px rgba(0,0,0,0.38), 0 9px 10px -1px rgba(0,0,0,0.35)',
          }}
        >
          {/* Spine system */}
          <div className="absolute left-0 top-0 bottom-0 w-[35px] z-20 pointer-events-none">
            <div className="absolute inset-y-0 left-0 w-[22px] bg-gradient-to-r from-black/45 via-black/15 to-transparent opacity-80" />
            <div className="absolute inset-y-0 left-0 w-[1px] bg-white/20 blur-[0.5px]" />
            <div className="absolute inset-y-0 left-[18px] w-[5px] flex">
              <div className="w-[0.5px] h-full bg-black/40" />
              <div className="w-[1px] h-full bg-white/10" />
              <div className="flex-1 h-full bg-gradient-to-r from-black/20 to-transparent" />
            </div>
            <div className="absolute inset-y-0 left-[3px] w-[8px] bg-white/5 blur-[3px]" />
          </div>

          {/* Cover text */}
          <div className="absolute inset-0 p-6 flex flex-col justify-center items-center text-center z-10">
            {isEditing ? (
              <input
                ref={inputRef}
                value={bookName}
                onChange={e => onNameChange(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') inputRef.current?.blur(); }}
                maxLength={10}
                className="bg-transparent border-b border-white/40 text-white text-sm font-bold text-center outline-none w-20"
                style={{ letterSpacing: '0.1em' }}
              />
            ) : (
              <h3
                onClick={e => { e.stopPropagation(); onStartEdit(); }}
                className="text-white font-black text-sm leading-tight tracking-tight drop-shadow-md cursor-text"
              >
                {bookName}
              </h3>
            )}
            <p className="text-white/30 text-[8px] font-bold uppercase tracking-[0.2em] mt-2">{subtitle}</p>
          </div>

          {/* Texture overlays */}
          <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none"
            style={{ backgroundImage: `url(${LEATHER_TEXTURE})`, backgroundSize: 'cover' }} />
          <div className="absolute inset-0 opacity-[0.35] mix-blend-multiply pointer-events-none"
            style={{ backgroundImage: `url(${PARCHMENT_TEXTURE})`, backgroundSize: 'cover' }} />

          {/* Sheen */}
          <div className="absolute top-0 left-[20px] right-0 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"
            style={{ transform: 'skewX(-15deg)' }} />
        </div>

        {/* Month label */}
        <p className="mt-3 text-center text-[11px]"
          style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)', fontWeight: isSelected ? 600 : 400, transition: 'color 0.2s' }}>
          {format(month, lang === 'zh' ? 'yyyy年M月' : 'MMMM yyyy', { locale })}
        </p>
      </motion.div>
    </div>
  );
}

/* ──────────────────────────── DiaryBookShelf ──────────────────── */
interface Props {
  onClose: () => void;
  reports: Report[];
  onOpenDiaryPage?: (date: Date, subPage: 0 | 1, flippedCount: number) => void;
  initialOpenMonth?: Date;
  initialOpenFlippedCount?: number;
}

export const DiaryBookShelf: React.FC<Props> = ({ onClose, reports, onOpenDiaryPage, initialOpenMonth, initialOpenFlippedCount }) => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore(s => s.user);
  const getMessagesForDateRange = useChatStore(s => s.getMessagesForDateRange);
  const firstBookMonth = useMemo(() => {
    const dailyReports = reports
      .filter((report) => report.type === 'daily')
      .sort((left, right) => left.date - right.date);
    if (dailyReports.length === 0) return null;
    return startOfMonth(new Date(dailyReports[0].date));
  }, [reports]);
  const [months, setMonths]       = useState<Date[]>(() => buildMonthList(firstBookMonth));
  const [openMonth, setOpenMonth] = useState<Date | null>(initialOpenMonth ?? null);
  const [viewerFlippedCount, setViewerFlippedCount] = useState<number | undefined>(initialOpenFlippedCount);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx]   = useState<number | null>(null);
  const [bookNames, setBookNames] = useState<Record<number, string>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [dayRecordCount, setDayRecordCount] = useState<Record<string, number>>({});
  const bookRefs = useRef<(HTMLDivElement | null)[]>([]);
  const loadedYearsRef = useRef<Set<number>>(new Set());

  const toDateKey = useCallback((date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, []);
  const parsedDateInput = useMemo(() => parseDateInput(searchInput), [searchInput]);
  const activeYear = parsedDateInput.year ?? new Date().getFullYear();
  const activeMonth = parsedDateInput.month;
  const showMonthView = activeMonth != null && parsedDateInput.isValid;
  const calendarLocale = useMemo(() => {
    const lang = i18n.language?.split('-')[0] ?? 'en';
    if (lang === 'zh') return zhCN;
    if (lang === 'it') return itLocale;
    return enUS;
  }, [i18n.language]);
  const weekLabelStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }).map((_, idx) => format(addDays(weekLabelStart, idx), 'EEEEE', { locale: calendarLocale })),
    [calendarLocale, weekLabelStart],
  );

  const getBookName = (m: Date) => bookNames[m.getTime()] ?? t('report_view_diary_book');
  const setBookName = (m: Date, name: string) =>
    setBookNames(prev => ({ ...prev, [m.getTime()]: name }));

  const openMonthByDate = useCallback((targetDate: Date) => {
    const monthDate = startOfMonth(targetDate);
    const idx = months.findIndex((m) => isSameMonth(m, monthDate));
    if (idx < 0) return false;
    setViewerFlippedCount(targetDate.getDate());
    setOpenMonth(monthDate);
    setSearchOpen(false);
    setSelectedIdx(idx);
    setEditingIdx(null);
    return true;
  }, [months]);

  const handleSearchSubmit = useCallback(() => {
    if (!parsedDateInput.selectedDate) {
      setSearchError('');
      return;
    }
    const ok = openMonthByDate(parsedDateInput.selectedDate);
    if (!ok) {
      setSearchError(t('diary_shelf_no_diary'));
      return;
    }
    setSearchError('');
  }, [i18n.language, openMonthByDate, parsedDateInput.selectedDate]);

  const getCountByDate = useCallback((date: Date) => dayRecordCount[toDateKey(date)] ?? 0, [dayRecordCount, toDateKey]);
  const hasBookForSelectedDate = useMemo(() => (
    parsedDateInput.selectedDate
      ? months.some((monthDate) => isSameMonth(monthDate, parsedDateInput.selectedDate!))
      : false
  ), [months, parsedDateInput.selectedDate]);

  const monthCells = useMemo(() => {
    if (!activeMonth || !parsedDateInput.isValid) return [] as Date[];
    const first = new Date(activeYear, activeMonth - 1, 1);
    const gridStart = startOfWeek(first, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(new Date(activeYear, activeMonth, 0), { weekStartsOn: 1 });
    const cells: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      cells.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return cells;
  }, [activeMonth, activeYear, parsedDateInput.isValid]);

  useEffect(() => {
    if (!searchOpen || !parsedDateInput.year || !parsedDateInput.isValid) return;
    if (loadedYearsRef.current.has(parsedDateInput.year)) return;
    let cancelled = false;
    const year = parsedDateInput.year;
    void getMessagesForDateRange(new Date(year, 0, 1), new Date(year, 11, 31, 23, 59, 59, 999))
      .then((messages) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        messages.forEach((msg) => {
          if (msg.type === 'system' || msg.mode !== 'record') return;
          const key = toDateKey(new Date(msg.timestamp));
          next[key] = (next[key] ?? 0) + 1;
        });
        setDayRecordCount((prev) => ({ ...prev, ...next }));
        loadedYearsRef.current.add(year);
      })
      .catch(() => {
        loadedYearsRef.current.add(year);
      });
    return () => {
      cancelled = true;
    };
  }, [getMessagesForDateRange, parsedDateInput.isValid, parsedDateInput.year, searchOpen, toDateKey]);

  useEffect(() => {
    setMonths(buildMonthList(firstBookMonth));
  }, [firstBookMonth]);

  /* Keyboard navigation */
  const openSelected = useCallback(() => {
    if (selectedIdx !== null) {
      setViewerFlippedCount(undefined);
      setOpenMonth(months[selectedIdx]);
    }
  }, [months, selectedIdx]);

  useEffect(() => {
    if (openMonth) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setEditingIdx(null);
        setSelectedIdx(prev => Math.min((prev ?? -1) + 1, months.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setEditingIdx(null);
        setSelectedIdx(prev => Math.max((prev ?? 1) - 1, 0));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openSelected();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openMonth, months, openSelected, onClose]);

  /* Scroll selected into view */
  useEffect(() => {
    if (selectedIdx === null) return;
    bookRefs.current[selectedIdx]?.scrollIntoView({
      behavior: 'smooth', inline: 'center', block: 'nearest',
    });
  }, [selectedIdx]);

  if (openMonth) {
    return (
      <DiaryBookViewer
        onClose={onClose}
        onBackToShelf={() => setOpenMonth(null)}
        reports={reports}
        initialMonth={openMonth}
        initialFlippedCount={viewerFlippedCount}
        onOpenDiaryPage={onOpenDiaryPage}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#f4f7f4]" style={{ userSelect: 'none' }}>
      {/* Ambient glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#8fae9115] blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-white blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="relative z-20 flex items-center gap-3 px-6 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="flex-shrink-0 p-3.5 bg-white/90 backdrop-blur-xl rounded-[22px] text-[#4a5d4c] shadow-[0_8px_20px_rgba(0,0,0,0.04)] border border-white/80"
        >
          <ChevronLeft size={20} />
        </motion.button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-black text-[#4a5d4c] tracking-tight">{t('report_my_diary')}</h1>
          <p className="mt-0.5 text-[10px] font-medium text-[#4a5d4c]">{t('diary_shelf_count', { count: months.length })}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setSearchOpen(true)}
          aria-label={t('diary_shelf_open_calendar')}
          className="flex-shrink-0 h-14 w-14 bg-white/90 backdrop-blur-xl rounded-full text-[#4a5d4c] shadow-[0_10px_24px_rgba(0,0,0,0.06)] border border-white/80 flex items-center justify-center"
        >
          <Search size={24} strokeWidth={2.2} />
        </motion.button>
      </header>

      {searchOpen && (
        <div
          className="absolute inset-0 z-40"
          style={{ background: 'rgba(30,45,32,0.18)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="absolute left-4 right-4 overflow-hidden"
            style={{
              top: 'calc(env(safe-area-inset-top, 0px) + 84px)',
              borderRadius: '28px',
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.5), inset 0 1px 1px rgba(255,255,255,0.8), 0 24px 64px rgba(30,50,35,0.22)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input section */}
            <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(210,225,210,0.6)', background: 'linear-gradient(to bottom, #f8faf7, #f2f7f1)' }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(74,93,76,0.55)', textTransform: 'uppercase' }}>{t('diary_shelf_open_calendar')}</span>
                {showMonthView && (
                  <button
                    type="button"
                    onClick={() => setSearchInput(String(activeYear))}
                    style={{ fontSize: '11px', fontWeight: 600, color: '#5f7a62', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    {t('diary_shelf_back_year')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value.replace(/[^\d\s\-/.]/g, ''));
                      if (searchError) setSearchError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchSubmit();
                      }
                    }}
                    placeholder="2026 / 04 / 20"
                    className="w-full outline-none"
                    inputMode="numeric"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      borderRadius: '16px',
                      border: '1.5px solid rgba(171,199,178,0.78)',
                      background: 'linear-gradient(155deg, rgba(255,255,255,0.9), rgba(242,249,244,0.82))',
                      padding: '11px 16px',
                      fontSize: '16px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: '#2e4431',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(164,190,171,0.32), 0 8px 16px rgba(88,121,96,0.08)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#8aac93';
                      e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -1px 0 rgba(154,186,164,0.4), 0 0 0 3px rgba(135,171,146,0.18), 0 10px 20px rgba(88,121,96,0.12)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(171,199,178,0.78)';
                      e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -1px 0 rgba(164,190,171,0.32), 0 8px 16px rgba(88,121,96,0.08)';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  disabled={!parsedDateInput.selectedDate}
                  style={{
                    width: '46px', height: '46px', borderRadius: '14px', flexShrink: 0,
                    background: parsedDateInput.selectedDate ? DAY_MARK_SELECTED : 'rgba(255,255,255,0.72)',
                    border: parsedDateInput.selectedDate ? '1px solid rgba(63,91,73,0.42)' : '1.5px solid rgba(171,199,178,0.7)',
                    color: parsedDateInput.selectedDate ? '#ffffff' : '#4a5d4c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                    cursor: parsedDateInput.selectedDate ? 'pointer' : 'not-allowed',
                    opacity: parsedDateInput.selectedDate ? 1 : 0.5,
                    boxShadow: parsedDateInput.selectedDate ? '0 10px 20px rgba(58,84,68,0.22), inset 0 1px 0 rgba(255,255,255,0.14)' : 'inset 0 1px 0 rgba(255,255,255,0.86)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <Search size={18} strokeWidth={2.2} />
                </button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(74,93,76,0.55)', letterSpacing: '0.03em' }}>
                {i18n.language?.split('-')[0] === 'zh' ? '仅输入数字，如 20260420' : i18n.language?.split('-')[0] === 'it' ? 'Solo numeri, es. 20260420' : 'Digits only, e.g. 20260420'}
              </div>
              {searchError ? (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#b54b4b', fontWeight: 600 }}>
                  {searchError}
                </div>
              ) : null}
            </div>

            {/* Calendar body */}
            <div className="px-4 py-4" style={{ background: '#f5f8f3' }}>
              {!showMonthView ? (
                /* Year view — month grid */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => setSearchInput(String(activeYear - 1))}
                      style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(200,217,196,0.8)', color: '#4a5d4c' }}
                    >
                      <ChevronLeft size={16} strokeWidth={2} />
                    </button>
                    <span style={{ fontSize: '17px', fontWeight: 800, color: '#2e4431', letterSpacing: '-0.02em' }}>{activeYear}</span>
                    <button
                      type="button"
                      onClick={() => setSearchInput(String(activeYear + 1))}
                      style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(200,217,196,0.8)', color: '#4a5d4c' }}
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const monthNum = idx + 1;
                      const isPicked = parsedDateInput.month === monthNum;
                      const label = format(new Date(activeYear, idx, 1), i18n.language?.split('-')[0] === 'zh' ? 'M月' : 'MMM', { locale: calendarLocale });
                      return (
                        <button
                          key={monthNum}
                          type="button"
                          onClick={() => setSearchInput(`${activeYear} ${monthNum}`)}
                          style={{
                            borderRadius: '14px',
                            padding: '10px 6px',
                            fontSize: '13px',
                            fontWeight: isPicked ? 700 : 500,
                            background: isPicked ? '#3d5244' : 'rgba(255,255,255,0.85)',
                            border: isPicked ? 'none' : '1.5px solid rgba(200,217,196,0.7)',
                            color: isPicked ? '#ffffff' : '#3f5142',
                            boxShadow: isPicked ? '0 4px 12px rgba(61,82,68,0.25)' : 'none',
                            transition: 'background 0.15s, color 0.15s',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Month view — day grid */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        const prevMonth = activeMonth! - 1;
                        if (prevMonth < 1) {
                          setSearchInput(`${activeYear - 1} 12`);
                        } else {
                          setSearchInput(`${activeYear} ${prevMonth}`);
                        }
                      }}
                      style={{ width: '30px', height: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(200,217,196,0.8)', color: '#4a5d4c' }}
                    >
                      <ChevronLeft size={15} strokeWidth={2} />
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#2e4431', letterSpacing: '-0.01em' }}>
                      {format(new Date(activeYear, (activeMonth ?? 1) - 1, 1), i18n.language?.split('-')[0] === 'zh' ? 'yyyy年M月' : 'MMMM yyyy', { locale: calendarLocale })}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMonth = activeMonth! + 1;
                        if (nextMonth > 12) {
                          setSearchInput(`${activeYear + 1} 1`);
                        } else {
                          setSearchInput(`${activeYear} ${nextMonth}`);
                        }
                      }}
                      style={{ width: '30px', height: '30px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(200,217,196,0.8)', color: '#4a5d4c' }}
                    >
                      <ChevronRight size={15} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1" style={{ marginBottom: '6px' }}>
                    {weekdayLabels.map((label) => (
                      <div key={label} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: 'rgba(74,93,76,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingBottom: '4px' }}>
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {monthCells.map((date) => {
                      const inMonth = date.getMonth() + 1 === activeMonth;
                      const count = inMonth ? getCountByDate(date) : 0;
                      const isSelected = parsedDateInput.selectedDate ? isSameDay(date, parsedDateInput.selectedDate) : false;

                      let bg = 'transparent';
                      let textColor = inMonth ? '#2f4232' : 'rgba(100,120,100,0.25)';
                      let borderStyle = 'none';
                      let shadow = 'none';

                      if (!inMonth) {
                        bg = 'transparent';
                      } else if (isSelected) {
                        bg = DAY_MARK_SELECTED;
                        textColor = '#ffffff';
                        borderStyle = '1px solid rgba(56,81,65,0.45)';
                        shadow = '0 8px 16px rgba(58,84,68,0.22), inset 0 1px 0 rgba(255,255,255,0.18)';
                      } else if (count > 5) {
                        bg = DAY_MARK_DEEP;
                        textColor = '#1f3525';
                        borderStyle = '1px solid rgba(97,129,109,0.42)';
                        shadow = '0 4px 12px rgba(95,130,106,0.16), inset 0 1px 0 rgba(255,255,255,0.32)';
                      } else if (count >= 3) {
                        bg = DAY_MARK_MID;
                        textColor = '#2b4430';
                        borderStyle = '1px solid rgba(144,175,153,0.42)';
                        shadow = '0 3px 10px rgba(110,142,119,0.12), inset 0 1px 0 rgba(255,255,255,0.45)';
                      } else if (count > 0) {
                        bg = DAY_MARK_LIGHT;
                        borderStyle = '1px solid rgba(171,199,178,0.45)';
                        shadow = 'inset 0 1px 0 rgba(255,255,255,0.5)';
                      } else {
                        bg = 'linear-gradient(160deg, rgba(255,255,255,0.82), rgba(246,250,247,0.74))';
                        borderStyle = '1px solid rgba(194,213,199,0.56)';
                        shadow = 'inset 0 1px 0 rgba(255,255,255,0.72)';
                      }

                      return (
                        <button
                          key={date.toISOString()}
                          type="button"
                          disabled={!inMonth}
                          onClick={() => {
                            if (!inMonth) return;
                            if (isSelected) {
                              openMonthByDate(date);
                              return;
                            }
                            setSearchInput(`${activeYear} ${activeMonth} ${date.getDate()}`);
                          }}
                          style={{
                            height: '36px',
                            width: '100%',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: isSelected ? 700 : count > 0 ? 600 : 400,
                            background: bg,
                            border: borderStyle,
                            color: textColor,
                            boxShadow: shadow,
                            transition: 'background 0.12s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: inMonth ? 'pointer' : 'default',
                            position: 'relative',
                            backdropFilter: inMonth ? 'blur(8px)' : undefined,
                            WebkitBackdropFilter: inMonth ? 'blur(8px)' : undefined,
                          }}
                        >
                          {inMonth && date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  {parsedDateInput.selectedDate && (
                    <div style={{ marginTop: '12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        style={{
                          width: '100%', borderRadius: '14px', padding: '11px',
                          background: '#3d5244', color: '#ffffff',
                          fontSize: '14px', fontWeight: 700, border: 'none',
                          boxShadow: '0 4px 14px rgba(61,82,68,0.3)',
                        }}
                      >
                        {(() => {
                          const d = parsedDateInput.selectedDate!;
                          return t('diary_shelf_open_date', { date: format(d, i18n.language?.split('-')[0] === 'zh' ? 'M月d日' : 'MMM d', { locale: calendarLocale }) });
                        })()}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Book shelf — absolutely centered on full page so header/stats don't offset it */}
      <div className="absolute inset-0 z-30 flex items-center pointer-events-none">
        <div className="w-full overflow-x-auto snap-x snap-mandatory flex pointer-events-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
          <div className="flex-shrink-0 w-8" />
          <div className="flex gap-6 py-4 pr-12">
            {months.map((m, idx) => (
              <BookThumb
                key={m.getTime()}
                month={m}
                isSelected={idx === selectedIdx}
                isEditing={idx === editingIdx}
                bookName={getBookName(m)}
                onCoverClick={() => {
                  if (selectedIdx === null || idx !== selectedIdx) {
                    setEditingIdx(null);
                    setSelectedIdx(idx);
                  } else {
                    setViewerFlippedCount(undefined);
                    setOpenMonth(m);
                  }
                }}
                onStartEdit={() => { setSelectedIdx(idx); setEditingIdx(idx); }}
                onNameChange={name => setBookName(m, name)}
                divRef={el => { bookRefs.current[idx] = el; }}
              />
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `.no-scrollbar::-webkit-scrollbar { display: none; }` }} />
    </div>
  );
};

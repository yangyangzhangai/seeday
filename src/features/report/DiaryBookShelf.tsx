import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, startOfMonth, subMonths, isSameMonth, getDaysInMonth, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { zhCN, enUS, it as itLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
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
const DAY_MARK_LIGHT    = 'rgba(208,232,216,0.76)';
const DAY_MARK_MID      = 'rgba(118,168,136,0.76)';
const DAY_MARK_DEEP     = 'rgba(76,118,92,0.80)';
const DAY_MARK_SELECTED = 'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(191,219,254,0.90) 45%, rgba(147,197,253,0.72) 100%) padding-box, linear-gradient(140deg, rgba(147,197,253,0.52) 0%, rgba(239,246,255,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box';

type ParsedDateInput = {
  year: number | null;
  month: number | null;
  day: number | null;
  selectedDate: Date | null;
  isValid: boolean;
};

type SearchResult = { date: Date; snippet: string; field: 'diary' | 'observation' | 'activity' | 'mood' };

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
  const [searchPending, setSearchPending] = useState(false);
  const [dayRecordCount, setDayRecordCount] = useState<Record<string, number>>({});
  const bookRefs = useRef<(HTMLDivElement | null)[]>([]);
  const loadedYearsRef = useRef<Set<number>>(new Set());

  const toDateKey = useCallback((date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, []);
  const parsedDateInput = useMemo(() => parseDateInput(searchInput), [searchInput]);
  const lang = i18n.language?.split('-')[0] ?? 'en';
  const isTextSearch = useMemo(() => /[^\d\s\-/.]/.test(searchInput) && searchInput.trim().length > 0, [searchInput]);
  const textSearchResults = useMemo((): SearchResult[] => {
    if (!isTextSearch) return [];
    const q = searchInput.trim().toLowerCase();
    if (q.length < 1) return [];
    const found: SearchResult[] = [];
    for (const report of reports) {
      if (report.type !== 'daily') continue;
      const date = new Date(report.date);
      const candidates: Array<{ text: string; field: SearchResult['field'] }> = [
        { text: report.userNote ?? '', field: 'diary' },
        { text: report.aiAnalysis ?? report.teaserText ?? '', field: 'observation' },
        { text: report.stats?.actionSummary ?? '', field: 'activity' },
        { text: report.stats?.moodSummary ?? '', field: 'mood' },
      ];
      for (const { text, field } of candidates) {
        if (!text) continue;
        const lower = text.toLowerCase();
        const idx = lower.indexOf(q);
        if (idx === -1) continue;
        const start = Math.max(0, idx - 12);
        const snippet = (start > 0 ? '…' : '') + text.slice(start, start + 55) + (start + 55 < text.length ? '…' : '');
        found.push({ date, snippet, field });
        break;
      }
    }
    return found.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [isTextSearch, searchInput, reports]);
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

  const getDateRecordCount = useCallback(async (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const messages = await getMessagesForDateRange(start, end);
    const count = messages.filter((msg) => msg.type !== 'system' && msg.mode === 'record').length;
    setDayRecordCount((prev) => ({ ...prev, [toDateKey(date)]: count }));
    return count;
  }, [getMessagesForDateRange, toDateKey]);

  const handleSearchSubmit = useCallback(async (targetDate = parsedDateInput.selectedDate) => {
    if (!targetDate) {
      setSearchError('');
      return;
    }
    if (!months.some((monthDate) => isSameMonth(monthDate, targetDate))) {
      setSearchError(t('diary_shelf_no_diary'));
      return;
    }

    setSearchPending(true);
    try {
      const dateKey = toDateKey(targetDate);
      const cachedCount = dayRecordCount[dateKey];
      const count = cachedCount ?? (loadedYearsRef.current.has(targetDate.getFullYear()) ? 0 : await getDateRecordCount(targetDate));
      if (count <= 0) {
        setSearchError(t('diary_shelf_no_diary'));
        return;
      }

      const ok = openMonthByDate(targetDate);
      if (!ok) {
        setSearchError(t('diary_shelf_no_diary'));
        return;
      }
      setSearchError('');
    } catch {
      setSearchError(t('diary_shelf_no_diary'));
    } finally {
      setSearchPending(false);
    }
  }, [dayRecordCount, getDateRecordCount, months, openMonthByDate, parsedDateInput.selectedDate, t, toDateKey]);

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
    if (openMonth || searchOpen) return;
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
  }, [openMonth, months, openSelected, onClose, searchOpen]);

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
          <p className="mt-0.5 text-[13px] font-medium text-[#4a5d4c]">{t('diary_shelf_count', { count: months.length })}</p>
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
          className="absolute inset-0 z-40 flex items-center justify-center p-6"
          style={{ background: 'rgba(15,23,42,0.42)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-xs animate-in fade-in zoom-in-95 overflow-hidden"
            style={{
              borderRadius: 34,
              padding: 16,
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(255,255,255,0.82)',
              boxShadow: '0 24px 54px rgba(40,56,44,0.18), inset 0 1px 0 rgba(255,255,255,0.8)',
              backdropFilter: 'blur(18px) saturate(130%)',
              WebkitBackdropFilter: 'blur(18px) saturate(130%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input section */}
            <div className="pb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">{t('diary_shelf_open_calendar')}</span>
                <div className="flex items-center gap-2">
                  {showMonthView && (
                  <button
                    type="button"
                    onClick={() => setSearchInput(String(activeYear))}
                    style={{ fontSize: '11px', fontWeight: 600, color: '#5f7a62', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    {t('diary_shelf_back_year')}
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    className="rounded-full border border-white/70 bg-white/80 p-1 text-[#2F3E33] shadow-[inset_0_1px_1px_rgba(255,255,255,0.72),0_8px_18px_rgba(148,163,184,0.2)]"
                  >
                    <X size={24} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value);
                      if (searchError) setSearchError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleSearchSubmit();
                      }
                    }}
                    placeholder=""
                    className="w-full outline-none"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{
                      borderRadius: '16px',
                      border: '1px solid rgba(255,255,255,0.78)',
                      background: 'rgba(255,255,255,0.82)',
                      padding: '11px 16px',
                      fontSize: '16px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: '#2e4431',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#8aac93';
                      e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.86), 0 0 0 3px rgba(135,171,146,0.18)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.78)';
                      e.target.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8)';
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSearchSubmit()}
                  disabled={!parsedDateInput.selectedDate || searchPending}
                  style={{
                    width: '46px', height: '46px', borderRadius: '16px', flexShrink: 0,
                    background: parsedDateInput.selectedDate ? 'rgba(144.67,212.06,122.21,0.20)' : 'rgba(255,255,255,0.72)',
                    border: '1px solid rgba(255,255,255,0.78)',
                    color: '#5F7A63',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                    cursor: parsedDateInput.selectedDate && !searchPending ? 'pointer' : 'not-allowed',
                    opacity: parsedDateInput.selectedDate && !searchPending ? 1 : 0.5,
                    boxShadow: parsedDateInput.selectedDate ? '0px 2px 2px #C8C8C8' : 'inset 0 1px 0 rgba(255,255,255,0.86)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <Search size={18} strokeWidth={2.2} />
                </button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(74,93,76,0.52)', letterSpacing: '0.03em' }}>
                {t('diary_shelf_search_hint')}
              </div>
              {searchError ? (
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#b54b4b', fontWeight: 600 }}>
                  {searchError}
                </div>
              ) : null}
            </div>

            {/* Calendar body */}
            <div className="calendar-wrapper relative" style={{ paddingTop: 4 }}>
              {isTextSearch ? (
                /* Text search results */
                textSearchResults.length === 0 ? (
                  searchInput.trim().length > 0 ? (
                    <div style={{ padding: '20px 0 8px', textAlign: 'center', fontSize: 13, color: 'rgba(74,93,76,0.45)' }}>
                      {t('diary_shelf_text_no_results')}
                    </div>
                  ) : null
                ) : (
                  <div>
                    <div style={{ marginBottom: 8, fontSize: 11, color: 'rgba(74,93,76,0.42)', fontWeight: 500 }}>
                      {t('diary_shelf_text_results_count', { count: textSearchResults.length })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 230, overflowY: 'auto', scrollbarWidth: 'none' }}>
                      {textSearchResults.map((result, idx) => {
                        const fieldLabel: Record<SearchResult['field'], string> = {
                          diary: t('diary_shelf_field_diary'),
                          observation: t('diary_shelf_field_observation'),
                          activity: t('diary_shelf_field_activity'),
                          mood: t('diary_shelf_field_mood'),
                        };
                        const dateLabel = format(result.date, lang === 'zh' ? 'M月d日' : 'MMM d, yyyy', { locale: calendarLocale });
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => { void openMonthByDate(result.date); }}
                            style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(210,228,218,0.60)', cursor: 'pointer', width: '100%' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#2f4232' }}>{dateLabel}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: '#7a9a7e', background: 'rgba(120,165,135,0.12)', padding: '2px 7px', borderRadius: 999 }}>{fieldLabel[result.field]}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: '#5a7460', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{result.snippet}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : !showMonthView ? (
                /* Year view — month grid */
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => setSearchInput(String(activeYear - 1))}
                      style={{ width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,251,249,0.92)', border: '1px solid rgba(205,225,212,0.60)', color: '#4a5d4c', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
                    >
                      <ChevronLeft size={16} strokeWidth={2} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#4a5d4c' }}>{activeYear}</span>
                    <button
                      type="button"
                      onClick={() => setSearchInput(String(activeYear + 1))}
                      style={{ width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,251,249,0.92)', border: '1px solid rgba(205,225,212,0.60)', color: '#4a5d4c', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
                    >
                      <ChevronRight size={16} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const monthNum = idx + 1;
                      const isPicked = parsedDateInput.month === monthNum;
                      const label = format(new Date(activeYear, idx, 1), lang === 'zh' ? 'M月' : 'MMM', { locale: calendarLocale });
                      return (
                        <button
                          key={monthNum}
                          type="button"
                          onClick={() => setSearchInput(`${activeYear} ${monthNum}`)}
                          style={{
                            borderRadius: 18,
                            padding: '10px 6px',
                            fontSize: 13,
                            fontWeight: isPicked ? 600 : 400,
                            background: isPicked ? DAY_MARK_SELECTED : 'rgba(248,251,249,0.80)',
                            border: isPicked ? '0.5px solid transparent' : '1px solid rgba(205,225,212,0.50)',
                            color: isPicked ? '#1d4ed8' : '#4a5d4c',
                            boxShadow: isPicked ? '0 3px 8px rgba(59,130,246,0.10)' : '0 1px 3px rgba(0,0,0,0.04)',
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
                      style={{ width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,251,249,0.92)', border: '1px solid rgba(205,225,212,0.60)', color: '#4a5d4c', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
                    >
                      <ChevronLeft size={15} strokeWidth={2} />
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#4a5d4c' }}>
                      {format(new Date(activeYear, (activeMonth ?? 1) - 1, 1), lang === 'zh' ? 'yyyy年M月' : 'MMMM yyyy', { locale: calendarLocale })}
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
                      style={{ width: 30, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(248,251,249,0.92)', border: '1px solid rgba(205,225,212,0.60)', color: '#4a5d4c', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
                    >
                      <ChevronRight size={15} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1" style={{ marginBottom: 6 }}>
                    {weekdayLabels.map((label) => (
                      <div key={label} style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: '#a0b2a4', paddingBottom: 4 }}>
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
                      let textColor = inMonth ? '#2f4232' : 'rgba(100,120,100,0.22)';
                      let borderStyle = 'none';
                      let shadow = 'none';
                      let fw: React.CSSProperties['fontWeight'] = 400;

                      if (isSelected) {
                        bg = DAY_MARK_SELECTED;
                        textColor = '#1d4ed8';
                        borderStyle = '0.5px solid transparent';
                        shadow = '0 3px 10px rgba(59,130,246,0.12)';
                        fw = 600;
                      } else if (count > 5) {
                        bg = DAY_MARK_DEEP;
                        textColor = 'rgba(238,248,242,0.95)';
                        borderStyle = '1px solid rgba(44,88,64,0.30)';
                        shadow = '0 2px 8px rgba(40,80,58,0.12)';
                        fw = 500;
                      } else if (count >= 3) {
                        bg = DAY_MARK_MID;
                        textColor = '#1c3422';
                        borderStyle = '1px solid rgba(88,145,112,0.34)';
                        shadow = '0 1px 5px rgba(80,130,100,0.08)';
                        fw = 500;
                      } else if (count > 0) {
                        bg = DAY_MARK_LIGHT;
                        borderStyle = '1px solid rgba(165,208,180,0.45)';
                        fw = 400;
                      }

                      return (
                        <button
                          key={date.toISOString()}
                          type="button"
                          disabled={!inMonth}
                          onClick={() => {
                            if (!inMonth) return;
                            if (isSelected) {
                              void handleSearchSubmit(date);
                              return;
                            }
                            setSearchInput(`${activeYear} ${activeMonth} ${date.getDate()}`);
                          }}
                          style={{
                            height: 36, width: '100%', borderRadius: 999,
                            fontSize: 13, fontWeight: fw,
                            background: bg, border: borderStyle, color: textColor,
                            boxShadow: shadow,
                            transition: 'background 0.12s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: inMonth ? 'pointer' : 'default',
                          }}
                        >
                          {inMonth && date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  {parsedDateInput.selectedDate && (
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => void handleSearchSubmit()}
                        disabled={searchPending}
                        style={{
                          width: '100%', borderRadius: 14, padding: '11px',
                          background: 'rgba(52,96,70,0.84)', color: 'rgba(238,248,242,0.95)',
                          fontSize: 14, fontWeight: 700, border: 'none',
                          boxShadow: '0 2px 10px rgba(52,96,70,0.16)',
                          opacity: searchPending ? 0.6 : 1,
                        }}
                      >
                        {(() => {
                          const d = parsedDateInput.selectedDate!;
                          return t('diary_shelf_open_date', { date: format(d, lang === 'zh' ? 'M月d日' : 'MMM d', { locale: calendarLocale }) });
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

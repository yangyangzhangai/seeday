import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Report } from '../../store/useReportStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DiaryBookViewer } from './DiaryBookViewer';

/* ──────────────────────────── constants ──────────────────────────── */
const LEATHER_TEXTURE = 'https://images.unsplash.com/photo-1729823546609-2b113553cdcd?q=80&w=1080';
const PARCHMENT_TEXTURE = 'https://images.unsplash.com/photo-1719563015025-83946fb49e49?q=80&w=1080';

const COVER_COLORS = ['#7c4a5a', '#4d7a9e', '#8aac8d', '#3d5244', '#b56740', '#9a7a3a', '#5c5e8a', '#3d6b6d'];

function coverColor(month: Date): string {
  const idx = (month.getFullYear() * 12 + month.getMonth()) % COVER_COLORS.length;
  return COVER_COLORS[idx];
}

/* ──────────────────────────── month list ────────────────────────── */
function buildMonthList(createdAt: Date | null): Date[] {
  if (!createdAt) return [];
  const current  = startOfMonth(new Date());
  const earliest = startOfMonth(createdAt);
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
  const color = coverColor(month);
  const subtitle = format(month, 'yyyy · MM月', { locale: zhCN });

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
          {format(month, 'yyyy年M月', { locale: zhCN })}
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
  const { t } = useTranslation();
  const user = useAuthStore(s => s.user);
  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const [months, setMonths]       = useState<Date[]>(() => buildMonthList(createdAt));
  const [openMonth, setOpenMonth] = useState<Date | null>(initialOpenMonth ?? null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx]   = useState<number | null>(null);
  const [bookNames, setBookNames] = useState<Record<number, string>>({});
  const bookRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toDateKey = useCallback((date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, []);
  const diaryDateSet = useMemo(() => new Set(reports.filter(r => r.type === 'daily').map(r => toDateKey(new Date(r.date)))), [reports, toDateKey]);

  const totalEntries = useMemo(() => reports.filter(r => r.type === 'daily').length, [reports]);

  const getBookName = (m: Date) => bookNames[m.getTime()] ?? '日记本';
  const setBookName = (m: Date, name: string) =>
    setBookNames(prev => ({ ...prev, [m.getTime()]: name }));

  /* Auto-add new month at midnight on the 1st */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const next1st = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      timer = setTimeout(() => {
        const newMonth = startOfMonth(new Date());
        setMonths(prev =>
          prev.length > 0 && isSameMonth(prev[0], newMonth) ? prev : [newMonth, ...prev]
        );
        schedule();
      }, next1st.getTime() - now.getTime());
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  /* Keyboard navigation */
  const openSelected = useCallback(() => {
    if (selectedIdx !== null) setOpenMonth(months[selectedIdx]);
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
        initialFlippedCount={initialOpenFlippedCount}
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
      <header className="relative z-20 flex items-center justify-between px-6 pb-6"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)' }}>
        <div>
          <h1 className="text-2xl font-black text-[#4a5d4c] tracking-tight">{t('report_my_diary')}</h1>
          <p className="text-xs text-[#4a5d4c]/40 mt-0.5">{months.length} 本日记</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          className="p-3.5 bg-white/90 backdrop-blur-xl rounded-[22px] text-[#4a5d4c] shadow-[0_8px_20px_rgba(0,0,0,0.04)] border border-white/80"
        >
          <X size={20} />
        </motion.button>
      </header>

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

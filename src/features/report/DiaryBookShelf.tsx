import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { format, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Report } from '../../store/useReportStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DiaryBookViewer } from './DiaryBookViewer';

/* ──────────────────────────── constants ──────────────────────────── */
const COVER_BG = "url('/assets/book.png') center/cover no-repeat";
const SHELF_BG = '#7a9b7e';

// Show exactly 2 books side-by-side with equal margins
const SHELF_PAD = 24;  // left/right padding of scroll container
const BOOK_GAP  = 20;  // gap between books
// CSS calc: (min(100vw, 430px) - padding*2 - gap) / 2
const THUMB_W_CSS = `calc((min(100vw, 430px) - ${SHELF_PAD * 2}px - ${BOOK_GAP}px) / 2)`;
const ASPECT_RATIO = 148 / 210; // A5 width / height

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
  return list; // index 0 = newest
}

/* ──────────────────────────── BookThumb ────────────────────────── */
interface ThumbProps {
  month: Date;
  isCurrent: boolean;
  isSelected: boolean;
  isEditing: boolean;
  bookName: string;
  onCoverClick: () => void;
  onStartEdit: () => void;
  onNameChange: (name: string) => void;
  divRef: (el: HTMLDivElement | null) => void;
}

function BookThumb({ month, isCurrent, isSelected, isEditing, bookName, onCoverClick, onStartEdit, onNameChange, divRef }: ThumbProps) {
  const lifted = isSelected;
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  return (
    <div ref={divRef} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
      <div
        onClick={onCoverClick}
        style={{
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          transform: lifted ? 'translateY(-8px)' : 'none',
          transition: 'transform 0.25s ease',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
        }}
      >
        {/* Book cover */}
        <div style={{ position: 'relative', width: THUMB_W_CSS, aspectRatio: `${ASPECT_RATIO}` }}>

          {/* Golden glow selection ring */}
          {isSelected && (
            <div style={{
              position: 'absolute',
              inset: -3,
              borderRadius: '4px 6px 6px 4px',
              border: '2px solid rgba(218,165,32,0.9)',
              boxShadow: '0 0 8px 3px rgba(218,165,32,0.45), 0 0 18px 6px rgba(218,165,32,0.2)',
              pointerEvents: 'none',
              zIndex: 1,
            }} />
          )}

          {/* Cover face */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: COVER_BG,
            borderRadius: '2px 4px 4px 2px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            overflow: 'hidden',
            filter: lifted
              ? 'drop-shadow(0 10px 16px rgba(0,0,0,0.55))'
              : 'drop-shadow(0 6px 10px rgba(0,0,0,0.38))',
            transition: 'filter 0.25s ease',
          }}>
            {/* Spine strip — two thin dark vertical lines */}
            <div style={{
              position: 'absolute', left: 0, top: 0, width: 7, height: '100%',
              background: 'rgba(0,0,0,0.13)',
              backgroundImage: 'linear-gradient(90deg, transparent 2.5px, rgba(0,0,0,0.38) 2.5px, rgba(0,0,0,0.38) 3px, transparent 3px, transparent 3.5px, rgba(0,0,0,0.38) 3.5px, rgba(0,0,0,0.38) 4px, transparent 4px)',
              borderRadius: '2px 0 0 2px',
            }} />

            {/* Cover title — click text to edit */}
            {isEditing ? (
              <input
                ref={inputRef}
                value={bookName}
                onChange={e => onNameChange(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') inputRef.current?.blur();
                }}
                maxLength={10}
                className="text-xs"
                style={{
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: '#6b5a3e',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(107,90,62,0.35)',
                  textAlign: 'center',
                  width: 62,
                  outline: 'none',
                  padding: '1px 2px',
                  cursor: 'text',
                }}
              />
            ) : (
              <span
                onClick={e => { e.stopPropagation(); onStartEdit(); }}
                className="text-xs font-bold"
                style={{ letterSpacing: 2, color: '#6b5a3e', cursor: 'text' }}
              >
                {bookName}
              </span>
            )}

            <span style={{ fontSize: 7.5, letterSpacing: 1, color: 'rgba(107,90,62,0.5)' }}>
              Diary
            </span>
          </div>

        </div>

        {/* Month label */}
        <span className="text-xs" style={{
          paddingLeft: 2,
          letterSpacing: 0.4,
          color: lifted ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
          fontWeight: lifted ? 600 : 400,
          transition: 'color 0.2s ease',
        }}>
          {format(month, 'yyyy年M月', { locale: zhCN })}
        </span>
      </div>
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
  const diaryDateSet = useMemo(() => new Set(reports.filter(report => report.type === 'daily').map(report => toDateKey(new Date(report.date)))), [reports, toDateKey]);

  const getBookName = (m: Date) => bookNames[m.getTime()] ?? '日记本';
  const setBookName = (m: Date, name: string) =>
    setBookNames(prev => ({ ...prev, [m.getTime()]: name }));

  /* Auto-add new month at midnight on the 1st */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now     = new Date();
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

  const currentMonth = startOfMonth(new Date());

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: SHELF_BG,
      display: 'flex', flexDirection: 'column',
      userSelect: 'none', touchAction: 'pan-x pan-y',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `calc(env(safe-area-inset-top, 0px) + 16px) 20px 0`, flexShrink: 0,
      }}>
        <div style={{ width: 32, height: 32 }} />
        <div style={{ textAlign: 'center' }}>
          <div className="text-base font-bold" style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: 1 }}>
            {t('report_my_diary')}
          </div>
          <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            {months.length} 本
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <X size={24} strokeWidth={1.5} />
        </button>
      </div>

      {/* Shelf row */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <div style={{
            display: 'flex', flexDirection: 'row', alignItems: 'flex-end',
            gap: BOOK_GAP,
            overflowX: 'auto',
            paddingLeft: SHELF_PAD, paddingRight: SHELF_PAD,
            paddingBottom: 24, paddingTop: 24,
            scrollSnapType: 'x mandatory',
            scrollPaddingLeft: SHELF_PAD,
            WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
            msOverflowStyle: 'none' as React.CSSProperties['msOverflowStyle'],
            scrollbarWidth: 'none' as React.CSSProperties['scrollbarWidth'],
          }}>
            {months.map((m, idx) => (
              <BookThumb
                key={m.getTime()}
                month={m}
                isCurrent={isSameMonth(m, currentMonth)}
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
    </div>
  );
};

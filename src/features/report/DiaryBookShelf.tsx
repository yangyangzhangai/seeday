import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X, CalendarDays } from 'lucide-react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useTranslation } from 'react-i18next';
import type { Report } from '../../store/useReportStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DiaryBookViewer } from './DiaryBookViewer';

/* ──────────────────────────── constants ──────────────────────────── */
const COVER_BG = 'linear-gradient(160deg, #f5edda 0%, #ecdfc6 100%)';
const SHELF_BG = '#7a9b7e';

const THUMB_W = 86;   // cover width
const THUMB_H = 124;  // cover height (≈ 180:260 ratio)

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
  const lifted = isCurrent || isSelected;
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
        <div style={{ position: 'relative', width: THUMB_W, height: THUMB_H }}>

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
            position: 'relative',
            width: THUMB_W,
            height: THUMB_H,
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
                style={{
                  fontSize: 11,
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
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#6b5a3e', cursor: 'text' }}
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
        <span style={{
          paddingLeft: 2,
          fontSize: 11,
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
  const { t, i18n } = useTranslation();
  const user = useAuthStore(s => s.user);
  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const [months, setMonths]       = useState<Date[]>(() => buildMonthList(createdAt));
  const [openMonth, setOpenMonth] = useState<Date | null>(initialOpenMonth ?? null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [editingIdx, setEditingIdx]   = useState<number | null>(null);
  const [bookNames, setBookNames] = useState<Record<number, string>>({});
  const [showCalendar, setShowCalendar] = useState(false);
  const bookRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    setOpenMonth(months[selectedIdx]);
  }, [months, selectedIdx]);

  useEffect(() => {
    if (openMonth) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setEditingIdx(null);
        setSelectedIdx(prev => Math.min(prev + 1, months.length - 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setEditingIdx(null);
        setSelectedIdx(prev => Math.max(prev - 1, 0));
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
    bookRefs.current[selectedIdx]?.scrollIntoView({
      behavior: 'smooth', inline: 'center', block: 'nearest',
    });
  }, [selectedIdx]);

  if (openMonth) {
    return (
      <DiaryBookViewer
        onClose={() => setOpenMonth(null)}
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
        padding: '44px 20px 0', flexShrink: 0,
      }}>
        <button
          onClick={() => setShowCalendar(true)}
          aria-label={t('diary_shelf_open_calendar')}
          style={{
            width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <CalendarDays size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>
            {t('report_my_diary')}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
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
          <X size={20} />
        </button>
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowCalendar(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 16, width: '100%', maxWidth: 320 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#4a3a2a' }}>{t('diary_shelf_open_calendar')}</span>
              <button onClick={() => setShowCalendar(false)} style={{ color: '#9a8878', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Calendar
                locale={i18n.language}
                className="w-full border-none text-xs"
                showNeighboringMonth={false}
                maxDate={new Date()}
                formatDay={(_, d) => String(d.getDate())}
                onClickDay={(value) => {
                  setShowCalendar(false);
                  onOpenDiaryPage?.(value, 0, 0);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Shelf row */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: -18,
            height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3,
          }} />
          <div style={{
            display: 'flex', flexDirection: 'row', alignItems: 'flex-end',
            gap: 20,
            overflowX: 'auto',
            paddingLeft: 28, paddingRight: 28,
            paddingBottom: 24, paddingTop: 24,
            scrollSnapType: 'x mandatory',
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
                  if (idx === selectedIdx) {
                    setOpenMonth(m);
                  } else {
                    setEditingIdx(null);
                    setSelectedIdx(idx);
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

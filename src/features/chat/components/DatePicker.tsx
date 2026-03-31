// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, MoreHorizontal, X } from 'lucide-react';
import { toLocalDateStr } from '../../../lib/dateUtils';
import { useAuthStore } from '../../../store/useAuthStore';
import { resizeImageToDataUrl } from '../../../lib/imageUtils';

export interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function shiftDate(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function listDates(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
const SAGE_GREEN_DEEP = '#5F7A63';
const blueGlowBg = 'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(191,219,254,0.90) 45%, rgba(147,197,253,0.72) 100%)';
const blueGlowBorder = '1px solid rgba(255,255,255,0.72)';
const blueGlowShadow = '0 8px 18px rgba(59,130,246,0.20), inset 0 1px 1px rgba(255,255,255,0.82)';
const DATE_PAST_PRELOAD_DAYS = 35;
const DATE_FUTURE_DAYS = 6;
const DATE_PREPEND_STEP_DAYS = 21;
const DATE_ITEM_WIDTH = 38;
const DATE_ITEM_GAP = 8;
const DATE_PREPEND_TRIGGER_PX = 64;

export const DatePicker: React.FC<DatePickerProps> = ({ selectedDate, onDateChange }) => {
  const user = useAuthStore(s => s.user);
  const updateAvatar = useAuthStore(s => s.updateAvatar);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const selectedStr = toLocalDateStr(selectedDate);

  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [stripStart, setStripStart] = useState<Date>(() => shiftDate(selectedDate, -DATE_PAST_PRELOAD_DAYS));
  const popupRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const prependPendingRef = useRef<number | null>(null);
  const hasInitialCenteredRef = useRef(false);

  const stripEnd = useMemo(() => shiftDate(today, DATE_FUTURE_DAYS), [todayStr]);
  const stripDates = useMemo(() => listDates(stripStart, stripEnd), [stripStart, stripEnd]);
  const isFuture = (d: Date) => toLocalDateStr(d) > todayStr;
  const isSelected = (d: Date) => toLocalDateStr(d) === selectedStr;

  useEffect(() => {
    const selectedStart = new Date(selectedDate);
    selectedStart.setHours(0, 0, 0, 0);
    if (selectedStart < stripStart) {
      setStripStart(shiftDate(selectedStart, -DATE_PAST_PRELOAD_DAYS));
      return;
    }
    const strip = stripRef.current;
    const target = strip?.querySelector(`[data-date="${selectedStr}"]`) as HTMLElement | null;
    if (!strip || !target) return;
    const stripRect = strip.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextLeft = strip.scrollLeft + targetRect.left - stripRect.left - (strip.clientWidth - targetRect.width) / 2;
    strip.scrollTo({ left: Math.max(0, nextLeft), behavior: hasInitialCenteredRef.current ? 'smooth' : 'auto' });
    hasInitialCenteredRef.current = true;
  }, [selectedDate, selectedStr, stripStart, stripDates.length]);

  useEffect(() => {
    if (prependPendingRef.current === null || !stripRef.current) return;
    stripRef.current.scrollLeft += prependPendingRef.current;
    prependPendingRef.current = null;
  }, [stripDates]);

  useEffect(() => {
    if (!showMonthPicker) return;
    const handle = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showMonthPicker]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const handleDayClick = useCallback((dateObj: Date) => {
    if (isFuture(dateObj)) return;
    onDateChange(dateObj);
    setViewMonth(dateObj.getMonth());
    setViewYear(dateObj.getFullYear());
    setShowMonthPicker(false);
  }, [onDateChange, todayStr]); // eslint-disable-line

  const prependPastDates = useCallback(() => {
    const strip = stripRef.current;
    if (!strip || strip.scrollLeft > DATE_PREPEND_TRIGGER_PX) return;
    setStripStart(prev => shiftDate(prev, -DATE_PREPEND_STEP_DAYS));
    prependPendingRef.current = DATE_PREPEND_STEP_DAYS * (DATE_ITEM_WIDTH + DATE_ITEM_GAP);
  }, []);

  const handleStripScroll = useCallback(() => {
    prependPastDates();
  }, [prependPastDates]);

  const avatarUrl = user?.user_metadata?.avatar_url;

  const handleAuthClick = async () => {
    if (!user) {
      navigate('/auth');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Month selector */}
        <div style={{ position: 'relative' }} ref={popupRef}>
          <button
            onClick={() => setShowMonthPicker(p => !p)}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
          >
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.01em' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <span className="material-symbols-outlined"
              style={{ fontSize: 18, color: '#94a3b8', transition: 'transform 0.2s',
                transform: showMonthPicker ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              expand_more
            </span>
          </button>

          {/* Month picker dropdown */}
          {showMonthPicker && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
              background: '#ffffff', borderRadius: '1rem',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
              padding: '8px 6px', width: 164,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 7, padding: '0 2px' }}>
                <button onClick={prevMonth} style={{ background: '#F1F5F9',
                  border: 'none', borderRadius: '50%',
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#64748b' }}>chevron_left</span>
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{viewYear}</span>
                <button onClick={nextMonth} style={{ background: '#F1F5F9',
                  border: 'none', borderRadius: '50%',
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#64748b' }}>chevron_right</span>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {MONTHS.map((m, idx) => {
                  const isCur = idx === viewMonth;
                  return (
                    <button key={m} onClick={() => { setViewMonth(idx); setShowMonthPicker(false); }}
                      style={{ padding: '5px 2px', borderRadius: '0.6rem',
                        border: 'none',
                        background: isCur ? '#FCE7F3' : '#F8FAFC',
                        color: isCur ? '#DB2777' : '#475569', fontSize: 10,
                        fontWeight: isCur ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowAvatarModal(true);
                  setShowAvatarMenu(false);
                }}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.90) 100%)',
                  border: '2.5px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 6px 20px rgba(148,163,184,0.22), 0 2px 8px rgba(255,255,255,0.58)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transform: 'translateY(-14px)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 30, color: SAGE_GREEN_DEEP }}>person</span>
                )}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await resizeImageToDataUrl(file, 640, 0.95);
                  await updateAvatar(dataUrl);
                  setShowAvatarMenu(false);
                  setShowAvatarModal(false);
                  e.target.value = '';
                }}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => { void handleAuthClick(); }}
              style={{
                height: 36,
                borderRadius: 9999,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'rgba(255,255,255,0.78)',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                cursor: 'pointer',
              }}
            >
              <LogIn size={15} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t('header_login')}</span>
            </button>
          )}
        </div>
      </div>

      <div
        ref={stripRef}
        className="date-strip"
        onScroll={handleStripScroll}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: DATE_ITEM_GAP,
          marginTop: -4,
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          scrollPaddingInline: `calc(50% - ${DATE_ITEM_WIDTH / 2}px)`,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: 2,
          touchAction: 'pan-x',
        }}
      >
        {stripDates.map((dateObj, i) => {
          const day = DAYS[dateObj.getDay()];
          const date = dateObj.getDate();
          const sel = isSelected(dateObj);
          const fut = isFuture(dateObj);
          return (
            <button
              key={`${toLocalDateStr(dateObj)}-${i}`}
              data-date={toLocalDateStr(dateObj)}
              onClick={() => handleDayClick(dateObj)}
              disabled={fut}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                cursor: fut ? 'not-allowed' : 'pointer',
                padding: '0 2px',
                transition: 'all 0.18s',
                opacity: fut ? 0.35 : 1,
                flex: `0 0 ${DATE_ITEM_WIDTH}px`,
                minWidth: DATE_ITEM_WIDTH,
                scrollSnapAlign: 'center',
              }}
            >
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
                textTransform: 'uppercase', color: sel ? '#2563EB' : '#94a3b8', transition: 'color 0.18s' }}>
                {day}
              </span>
              <div style={{ width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: sel ? blueGlowBg : '#F8FAFC',
                border: sel ? blueGlowBorder : '1px solid rgba(0,0,0,0.05)',
                boxShadow: sel ? blueGlowShadow : 'none',
                transition: 'all 0.18s' }}>
                <span style={{ fontSize: 12, fontWeight: sel ? 700 : 500,
                  color: sel ? '#1D4ED8' : '#94a3b8', transition: 'all 0.18s' }}>
                  {date}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <style>{`.date-strip::-webkit-scrollbar{display:none;}`}</style>

      {showAvatarModal && user ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowAvatarModal(false);
            setShowAvatarMenu(false);
          }}
        >
          <div
            className="relative overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-1.5 text-slate-600 shadow"
              onClick={() => {
                setShowAvatarModal(false);
                setShowAvatarMenu(false);
              }}
              title={t('auth_close')}
            >
              <X size={16} />
            </button>
            {showAvatarMenu ? (
              <div className="absolute bottom-12 right-3 z-10 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => fileRef.current?.click()}
                >
                  {t('auth_change_avatar')}
                </button>
              </div>
            ) : null}
            <button
              className="absolute bottom-3 right-3 z-10 rounded-full bg-white/90 p-2 text-slate-600 shadow"
              onClick={() => setShowAvatarMenu((v) => !v)}
              title={t('auth_more')}
            >
              <MoreHorizontal size={16} />
            </button>
            <div className="flex h-[min(320px,86vw)] w-[min(320px,86vw)] items-center justify-center bg-gray-100">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar large" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-6xl text-gray-300">person</span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, LogIn, MoreHorizontal, X } from 'lucide-react';
import { toLocalDateStr } from '../../../lib/dateUtils';
import { useAuthStore } from '../../../store/useAuthStore';
import { blobToDataUrl } from '../../../lib/imageUtils';
import { cn } from '../../../lib/utils';
import { triggerLightHaptic } from '../../../lib/haptics';
import { ImageCropModal } from './ImageCropModal';
import {
  APP_MODAL_CARD_CLASS,
  APP_MODAL_CLOSE_CLASS,
  APP_MODAL_OVERLAY_CLASS,
} from '../../../lib/modalTheme';

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
const DATE_PAST_PRELOAD_DAYS = 35;
const DATE_FUTURE_DAYS = 6;
const DATE_PREPEND_STEP_DAYS = 21;
const DATE_ITEM_WIDTH = 60;
const DATE_ITEM_GAP = 8;
const DATE_PREPEND_TRIGGER_PX = 100;
const BLUE_SELECTED_TEXT = '#1D4ED8';
const BLUE_SELECTED_BG = '#BFDBFE';
const BLUE_SELECTED_BORDER = '1px solid rgba(147, 197, 253, 0.72)';
const BLUE_SELECTED_SHADOW = 'none';

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
  const [cropFile, setCropFile] = useState<File | null>(null);
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
    setViewMonth(selectedDate.getMonth());
    setViewYear(selectedDate.getFullYear());
    const handle = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [selectedDate, showMonthPicker]);

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

  const handleMonthClick = useCallback((monthIndex: number) => {
    const nextDate = new Date(viewYear, monthIndex, selectedDate.getDate());
    if (nextDate.getMonth() !== monthIndex) {
      nextDate.setDate(0);
    }
    if (isFuture(nextDate)) {
      onDateChange(today);
    } else {
      onDateChange(nextDate);
    }
    setViewMonth(monthIndex);
    setShowMonthPicker(false);
  }, [onDateChange, selectedDate, today, todayStr, viewYear]); // eslint-disable-line

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

  const handleAvatarCropConfirm = useCallback(async (blob: Blob) => {
    setCropFile(null);
    try {
      const dataUrl = await blobToDataUrl(blob);
      const { error } = await updateAvatar(dataUrl);
      if (error) throw error;
      setShowAvatarMenu(false);
      setShowAvatarModal(false);
    } catch {
      window.alert(t('image_upload_fail'));
    }
  }, [t, updateAvatar]);

  const handleAuthClick = async () => {
    if (!user) {
      navigate('/onboarding');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Month selector */}
        <div style={{ position: 'relative' }} ref={popupRef}>
          <button
            onClick={() => {
              triggerLightHaptic();
              setShowMonthPicker(p => !p);
            }}
            className="flex items-center gap-2 rounded-2xl border border-transparent p-0 text-left cursor-pointer transition-all active:scale-[0.98] group"
            aria-label={t('diary_shelf_open_calendar')}
            title={t('diary_shelf_open_calendar')}
          >
            <span style={{
              color: '#1e293b',
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.5,
            }}>
              {MONTHS[selectedDate.getMonth()]}
            </span>
            <span style={{
              color: '#1e293b',
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.5,
            }}>
              {selectedDate.getFullYear()}
            </span>
            <ChevronDown size={22} strokeWidth={3} color="#94a3b8" style={{ marginLeft: 4 }} />
          </button>

          {/* Month picker dropdown */}
          {showMonthPicker && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 50,
              background: 'rgba(255,255,255,0.72)', borderRadius: '1rem',
              border: '1px solid rgba(255,255,255,0.82)',
              boxShadow: '0 16px 38px rgba(40,56,44,0.14), inset 0 1px 0 rgba(255,255,255,0.8)',
              backdropFilter: 'blur(18px) saturate(130%)',
              WebkitBackdropFilter: 'blur(18px) saturate(130%)',
              padding: '8px 6px', width: 164,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 7, padding: '0 2px' }}>
                <button onClick={() => { triggerLightHaptic(); prevMonth(); }} style={{ background: '#F1F5F9',
                  border: 'none', borderRadius: '50%',
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#64748b' }}>chevron_left</span>
                </button>
                <span className="text-xs" style={{ fontWeight: 700, color: '#1e293b' }}>{viewYear}</span>
                <button onClick={() => { triggerLightHaptic(); nextMonth(); }} style={{ background: '#F1F5F9',
                  border: 'none', borderRadius: '50%',
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#64748b' }}>chevron_right</span>
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {MONTHS.map((m, idx) => {
                  const isCur = idx === viewMonth;
                  return (
                    <button key={m} onClick={() => { triggerLightHaptic(); handleMonthClick(idx); }}
                      className="text-xs"
                      style={{ padding: '5px 2px', borderRadius: '0.6rem',
                        border: isCur ? BLUE_SELECTED_BORDER : '1px solid transparent',
                        background: isCur ? BLUE_SELECTED_BG : 'rgba(248,250,252,0.56)',
                        boxShadow: isCur ? BLUE_SELECTED_SHADOW : 'none',
                        color: isCur ? BLUE_SELECTED_TEXT : '#475569',
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
                  triggerLightHaptic();
                  setShowAvatarModal(true);
                  setShowAvatarMenu(false);
                }}
                style={{
                  width: 62,
                  height: 62,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.90) 100%)',
                  border: '2.5px solid rgba(255,255,255,0.95)',
                  boxShadow: '0 6px 20px rgba(148,163,184,0.22), 0 2px 8px rgba(255,255,255,0.58)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transform: 'translateY(-16px)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 34, color: SAGE_GREEN_DEEP }}>person</span>
                )}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCropFile(file);
                  setShowAvatarMenu(false);
                  setShowAvatarModal(false);
                  e.target.value = '';
                }}
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                void handleAuthClick();
              }}
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
              <span className="text-xs" style={{ fontWeight: 600 }}>{t('header_login')}</span>
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
              onClick={() => {
                if (fut) return;
                triggerLightHaptic();
                handleDayClick(dateObj);
              }}
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
              <span style={{ fontSize: 12, lineHeight: 1, fontWeight: 700, letterSpacing: '0.10em',
                 textTransform: 'uppercase', color: sel ? BLUE_SELECTED_TEXT : '#94a3b8', transition: 'color 0.18s' }}>
                {day}
              </span>
              <div style={{ width: 44, height: 44, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: sel ? BLUE_SELECTED_BG : '#F8FAFC',
                border: sel ? BLUE_SELECTED_BORDER : '1px solid rgba(0,0,0,0.05)',
                boxShadow: sel ? BLUE_SELECTED_SHADOW : 'none',
                transition: 'all 0.18s' }}>
                <span style={{ fontSize: 15, lineHeight: 1, fontWeight: sel ? 700 : 500,
                  color: sel ? BLUE_SELECTED_TEXT : '#94a3b8', transition: 'all 0.18s' }}>
                  {date}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <style>{`.date-strip::-webkit-scrollbar{display:none;}`}</style>

      {showAvatarModal && user ? createPortal(
        <div
          className={cn('fixed inset-0 z-[200] flex items-center justify-center p-4', APP_MODAL_OVERLAY_CLASS)}
          onClick={() => {
            triggerLightHaptic();
            setShowAvatarModal(false);
            setShowAvatarMenu(false);
          }}
        >
          <div
            className={cn(APP_MODAL_CARD_CLASS, 'relative overflow-hidden rounded-3xl')}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={cn(APP_MODAL_CLOSE_CLASS, 'absolute right-3 top-3 z-10 p-1.5')}
              onClick={() => {
                triggerLightHaptic();
                setShowAvatarModal(false);
                setShowAvatarMenu(false);
              }}
              title={t('auth_close')}
            >
              <X size={16} />
            </button>
            {showAvatarMenu ? (
              <div className={cn(APP_MODAL_CARD_CLASS, 'absolute bottom-12 right-3 z-10 overflow-hidden rounded-xl')}>
                <button
                  className="block w-full px-4 py-2 text-left text-sm text-[#2F3E33] hover:bg-white/70"
                  onClick={() => {
                    triggerLightHaptic();
                    fileRef.current?.click();
                  }}
                >
                  {t('auth_change_avatar')}
                </button>
              </div>
            ) : null}
            <button
              className={cn(APP_MODAL_CLOSE_CLASS, 'absolute bottom-3 right-3 z-10 p-2')}
              onClick={() => {
                triggerLightHaptic();
                setShowAvatarMenu((v) => !v);
              }}
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
      , document.body) : null}

      {cropFile ? createPortal(
        <ImageCropModal
          file={cropFile}
          aspectW={1}
          aspectH={1}
          outputW={240}
          outputH={240}
          outputQuality={0.82}
          onConfirm={(blob) => { void handleAvatarCropConfirm(blob); }}
          onCancel={() => setCropFile(null)}
        />,
        document.body,
      ) : null}
    </div>
  );
};

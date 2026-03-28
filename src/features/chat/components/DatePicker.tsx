// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, LogOut } from 'lucide-react';
import { toLocalDateStr } from '../../../lib/dateUtils';
import { useAuthStore } from '../../../store/useAuthStore';
import { LanguageSwitcher } from '../../../components/layout/LanguageSwitcher';

export interface DatePickerProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function getWeekDays(centerDate: Date) {
  const result = [];
  const dow = centerDate.getDay();
  for (let i = 0; i < 7; i++) {
    const d = new Date(centerDate);
    d.setDate(d.getDate() - dow + i);
    result.push({ day: DAYS[d.getDay()], date: d.getDate(), dateObj: d });
  }
  return result;
}

const SAGE_GREEN_DEEP = '#5F7A63';
const blueGlowBg = 'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(191,219,254,0.90) 45%, rgba(147,197,253,0.72) 100%)';
const blueGlowBorder = '1px solid rgba(255,255,255,0.72)';
const blueGlowShadow = '0 8px 18px rgba(59,130,246,0.20), inset 0 1px 1px rgba(255,255,255,0.82)';

export const DatePicker: React.FC<DatePickerProps> = ({ selectedDate, onDateChange }) => {
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const updateAvatar = useAuthStore(s => s.updateAvatar);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const selectedStr = toLocalDateStr(selectedDate);

  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => selectedDate);
  const touchStartX = useRef<number | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const weekDays = getWeekDays(weekAnchor);
  const isFuture = (d: Date) => toLocalDateStr(d) > todayStr;
  const isSelected = (d: Date) => toLocalDateStr(d) === selectedStr;

  // Sync weekAnchor when selectedDate changes
  useEffect(() => { setWeekAnchor(selectedDate); }, [selectedStr]); // eslint-disable-line

  // Close month picker on outside click
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
    setShowMonthPicker(false);
  }, [onDateChange, todayStr]); // eslint-disable-line

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta < -40) {
      setWeekAnchor(d => { const p = new Date(d); p.setDate(d.getDate() - 7); return p; });
    } else if (delta > 40) {
      const todayWeekStart = toLocalDateStr(getWeekDays(today)[0]);
      const anchorWeekStart = toLocalDateStr(weekDays[0].dateObj);
      if (anchorWeekStart < todayWeekStart) {
        setWeekAnchor(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
      }
    }
  }, [weekDays, today, todayStr]); // eslint-disable-line

  const avatarUrl = user?.user_metadata?.avatar_url;

  const resizeImageToDataUrl = (file: File, maxSize = 160): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('canvas_not_supported'));
            return;
          }
          const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAuthClick = async () => {
    if (user) {
      if (window.confirm(t('header_confirm_logout'))) {
        await signOut();
        navigate('/chat');
      }
      return;
    }
    navigate('/auth');
  };

  return (
    <div>
      {/* Top row: month selector + avatar */}
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
          <LanguageSwitcher />

          {user ? (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
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
                  const dataUrl = await resizeImageToDataUrl(file, 160);
                  await updateAvatar(dataUrl);
                }}
              />

              <button
                type="button"
                onClick={() => { void handleAuthClick(); }}
                title={t('header_confirm_logout')}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'rgba(255,255,255,0.75)',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <LogOut size={16} />
              </button>
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

      {/* Week strip */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, marginTop: -4 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {weekDays.map(({ day, date, dateObj }, i) => {
          const sel = isSelected(dateObj);
          const fut = isFuture(dateObj);
          return (
            <button key={i} onClick={() => handleDayClick(dateObj)}
              disabled={fut}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 3, background: 'none', border: 'none', cursor: fut ? 'not-allowed' : 'pointer',
                padding: '0 2px', transition: 'all 0.18s', opacity: fut ? 0.35 : 1 }}>
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
    </div>
  );
};

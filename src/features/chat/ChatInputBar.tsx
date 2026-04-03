import React from 'react';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { triggerLightHaptic } from '../../lib/haptics';

const SAGE_GREEN_DEEP = '#5F7A63';
const SAGE_GREEN = '#8FAF92';
const NAV_CARD_BG = 'rgba(255,255,255,0.30)';

const blueGlowBg =
  'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(191,219,254,0.90) 45%, rgba(147,197,253,0.72) 100%) padding-box, linear-gradient(140deg, rgba(147,197,253,0.52) 0%, rgba(239,246,255,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box';
const blueGlowBorder = '0.5px solid transparent';
const blueGlowShadow = '0 6px 14px rgba(59,130,246,0.14)';

const NAV_ITEMS = [
  { icon: 'chat_bubble',  path: '/chat'    },
  { icon: 'schedule',     path: '/growth'  },
  { icon: 'menu_book',    path: '/report'  },
  { icon: 'person',       path: '/profile' },
];

interface ChatInputBarProps {
  input: string;
  isLoading: boolean;
  isReadOnly?: boolean;
  readOnlyMessage?: string;
  isMagicPenModeOn: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onToggleMagicPenMode: () => void;
  inputError?: string | null;
}

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  input,
  isLoading,
  isReadOnly = false,
  readOnlyMessage,
  isMagicPenModeOn,
  onInputChange,
  onSend,
  onKeyDown,
  onToggleMagicPenMode,
  inputError,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const disabled = isLoading || isReadOnly;
  const hasInput = input.trim().length > 0;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 960, zIndex: 30, pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(to top, rgba(252,250,247,0.58) 55%, rgba(252,250,247,0))',
        paddingTop: 24, pointerEvents: 'none',
      }}>
        {/* Error / readonly hint */}
        {(inputError || (isReadOnly && readOnlyMessage)) && (
          <div style={{ paddingLeft: 'var(--app-page-gutter-x)', paddingRight: 'var(--app-page-gutter-x-right)', marginBottom: 6, pointerEvents: 'auto' }}>
            <p style={{ fontSize: 10, color: inputError ? '#EF4444' : '#94a3b8', margin: 0 }}>
              {inputError || readOnlyMessage}
            </p>
          </div>
        )}

        {/* Input bar */}
        <div style={{ paddingLeft: 'var(--app-page-gutter-x)', paddingRight: 'var(--app-page-gutter-x-right)', paddingBottom: 12, pointerEvents: 'auto' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 9999,
            border: inputError ? '2px solid #EF4444' : '1px solid rgba(0,0,0,0.05)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 7px 7px 14px',
          }}
          data-chat-input-box
          >
            {/* Magic pen toggle */}
            <button
              type="button"
              onClick={() => {
                if (disabled) return;
                triggerLightHaptic();
                onToggleMagicPenMode();
              }}
              disabled={disabled}
              aria-label={t(isMagicPenModeOn ? 'chat_magic_pen_mode_on' : 'chat_magic_pen_mode_off')}
              title={t(isMagicPenModeOn ? 'chat_magic_pen_mode_on' : 'chat_magic_pen_mode_off')}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: isMagicPenModeOn ? blueGlowBg : 'rgba(219,234,254,0.32)',
                border: isMagicPenModeOn ? blueGlowBorder : 'none',
                boxShadow: isMagicPenModeOn ? blueGlowShadow : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', opacity: disabled ? 0.5 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{
                fontSize: 18,
                color: isMagicPenModeOn ? '#1D4ED8' : '#94A3B8',
                transition: 'color 0.2s',
              }}>
                auto_fix_high
              </span>
            </button>

            <input
              type="text"
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('chat_placeholder_neutral')}
              disabled={disabled}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 16, color: '#0f172a',
              }}
            />

            <button
              onClick={() => {
                if (!hasInput || disabled) return;
                triggerLightHaptic();
                onSend();
              }}
              disabled={!hasInput || disabled}
              style={{
                width: 34, height: 34, borderRadius: 17,
                background: 'rgba(144.67, 212.06, 122.21, 0.20)',
                boxShadow: '0px 2px 2px #C8C8C8',
                color: SAGE_GREEN_DEEP,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (!hasInput || disabled) ? 'not-allowed' : 'pointer',
                flexShrink: 0, border: 'none',
                opacity: (!hasInput || disabled) ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {isLoading
                ? <Activity size={18} style={{ animation: 'spin 1s linear infinite' }} />
                : <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_upward</span>
              }
            </button>
          </div>
        </div>

        {/* Nav bar */}
        <div style={{ paddingLeft: 'var(--app-page-gutter-x)', paddingRight: 'var(--app-page-gutter-x-right)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)', pointerEvents: 'auto' }}>
          <nav style={{
            width: '100%', height: 64, borderRadius: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 8px',
            background: NAV_CARD_BG,
            backdropFilter: 'blur(20px) saturate(140%)',
            WebkitBackdropFilter: 'blur(20px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.58)',
            boxShadow: '0 0 12px rgba(255,255,255,0.20), inset 0 1px 1px rgba(255,255,255,0.55)',
          }}>
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.path || (item.path === '/chat' && pathname === '/');
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    triggerLightHaptic();
                    navigate(item.path);
                  }}
                  style={{
                    width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    background: active ? '#ffffff' : 'transparent',
                    backdropFilter: active ? 'blur(20px) saturate(140%)' : 'none',
                    WebkitBackdropFilter: active ? 'blur(20px) saturate(140%)' : 'none',
                    boxShadow: active
                      ? 'inset 0 2px 8px rgba(255,255,255,0.9), 0 10px 22px rgba(15,23,42,0.16), 0 0 0 1px rgba(255,255,255,0.9)'
                      : 'none',
                    transform: active ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  <span className="material-symbols-outlined"
                    style={{ fontSize: 26, color: active ? SAGE_GREEN_DEEP : SAGE_GREEN }}>
                    {item.icon}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Spin animation for loading */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

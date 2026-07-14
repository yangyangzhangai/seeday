export const APP_GLASS_BUTTON_BASE_STYLE = {
  background: 'var(--app-glass-base-background)',
  border: 'var(--app-glass-base-border)',
  boxShadow: 'var(--app-glass-base-shadow)',
} as const;

export const APP_MODAL_OVERLAY_CLASS =
  'app-modal-overlay bg-[rgba(15,23,42,0.42)] backdrop-blur-[10px]';

export const APP_MODAL_CARD_CLASS =
  'app-modal-card border border-[rgba(255,255,255,0.82)] bg-white [box-shadow:0_0_12px_rgba(255,255,255,0.20),inset_0_1px_1px_rgba(255,255,255,0.72),0_24px_64px_rgba(15,23,42,0.16)]';

export const APP_MODAL_CLOSE_CLASS =
  'app-glass-button rounded-full border border-white/70 bg-white/80 text-[#2F3E33] [box-shadow:0_6px_14px_rgba(165,190,103,0.14)] transition-colors hover:text-[#243129]';

export const APP_MODAL_INPUT_CLASS =
  'rounded-2xl border border-white/70 bg-white/85 text-slate-700 outline-none focus:ring-2 focus:ring-[#8FAF92]/45';

export const APP_MODAL_PRIMARY_BUTTON_CLASS =
  'app-glass-button rounded-2xl border border-transparent font-medium text-[#426D56] [background:linear-gradient(135deg,_rgba(236,248,229,0.96)_0%,_rgba(220,238,190,0.92)_100%)_padding-box,_linear-gradient(140deg,_rgba(208,230,161,0.55)_0%,_rgba(238,246,221,0.95)_55%,_rgba(255,255,255,0.98)_100%)_border-box] [box-shadow:0_6px_14px_rgba(183,207,124,0.12)] transition-opacity hover:opacity-90';

export const APP_MODAL_SECONDARY_BUTTON_CLASS =
  'app-glass-button rounded-2xl border border-white/70 bg-white/80 font-medium text-[#2F3E33] [box-shadow:0_6px_14px_rgba(165,190,103,0.14)] transition-colors hover:bg-white hover:text-[#243129]';

export const APP_SELECTED_GLOW_BG =
  'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(191,219,254,0.90) 45%, rgba(147,197,253,0.72) 100%) padding-box, linear-gradient(140deg, rgba(147,197,253,0.52) 0%, rgba(239,246,255,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box';

export const APP_SELECTED_GLOW_BORDER =
  '0.5px solid transparent';

export const APP_SELECTED_GLOW_SHADOW =
  '0 6px 14px rgba(59,130,246,0.14)';

export const APP_SELECTED_GLOW_TEXT = '#1D4ED8';

export const APP_GREEN_GLASS_BG =
  'linear-gradient(135deg, rgba(236,248,229,0.96) 0%, rgba(220,238,190,0.92) 100%) padding-box, linear-gradient(140deg, rgba(208,230,161,0.55) 0%, rgba(238,246,221,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box';

export const APP_GREEN_GLASS_BORDER = '0.5px solid transparent';

export const APP_GREEN_GLASS_SHADOW = '0 6px 14px rgba(183,207,124,0.12)';

export const APP_GREEN_GLASS_TEXT = '#426D56';

export const APP_GREEN_GLASS_BUTTON_STYLE = {
  ...APP_GLASS_BUTTON_BASE_STYLE,
  background: APP_GREEN_GLASS_BG,
  border: APP_GREEN_GLASS_BORDER,
  boxShadow: APP_GREEN_GLASS_SHADOW,
  color: APP_GREEN_GLASS_TEXT,
} as const;

export const APP_GREEN_TOGGLE_ON_STYLE = {
  background: 'linear-gradient(135deg, #DCECB8 0%, #D0E6A1 100%)',
} as const;

export const APP_PROFILE_JELLY_GREEN_BG = APP_GREEN_GLASS_BG;

export const APP_PROFILE_JELLY_BUTTON_STYLE = {
  ...APP_GLASS_BUTTON_BASE_STYLE,
  background: APP_PROFILE_JELLY_GREEN_BG,
  border: '0.5px solid transparent',
  borderRadius: '50px',
  boxShadow: '0 6px 14px rgba(165,190,103,0.14)',
  color: APP_GREEN_GLASS_TEXT,
  transition: 'all 0.15s',
} as const;

export const APP_PROFILE_JELLY_TOGGLE_ON_STYLE = {
  ...APP_GLASS_BUTTON_BASE_STYLE,
  background: APP_GREEN_TOGGLE_ON_STYLE.background,
  border: '0.5px solid transparent',
  boxShadow: '0 6px 14px rgba(165,190,103,0.14)',
  transition: 'all 0.15s',
} as const;

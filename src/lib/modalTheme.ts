export const APP_GLASS_BUTTON_BASE_STYLE = {
  border: '0.5px solid transparent',
  boxShadow: '0 6px 14px rgba(165,190,103,0.14), inset 0 1px 0 rgba(255,255,255,0.3)',
  backdropFilter: 'blur(20px) saturate(128%)',
  WebkitBackdropFilter: 'blur(20px) saturate(128%)',
} as const;

export const APP_MODAL_OVERLAY_CLASS =
  'app-modal-overlay bg-[rgba(15,23,42,0.42)] backdrop-blur-[10px]';

export const APP_MODAL_CARD_CLASS =
  'app-modal-card border border-[rgba(255,255,255,0.82)] bg-white [box-shadow:0_0_12px_rgba(255,255,255,0.20),inset_0_1px_1px_rgba(255,255,255,0.72),0_24px_64px_rgba(15,23,42,0.16)]';

export const APP_MODAL_CLOSE_CLASS =
  'rounded-full border border-white/70 bg-white/80 text-[#2F3E33] [box-shadow:0_6px_14px_rgba(165,190,103,0.14),inset_0_1px_0_rgba(255,255,255,0.3)] [backdrop-filter:blur(20px)_saturate(128%)] [-webkit-backdrop-filter:blur(20px)_saturate(128%)] transition-colors hover:text-[#243129]';

export const APP_MODAL_INPUT_CLASS =
  'rounded-2xl border border-white/70 bg-white/85 text-slate-700 outline-none focus:ring-2 focus:ring-[#8FAF92]/45';

export const APP_MODAL_PRIMARY_BUTTON_CLASS =
  'rounded-2xl border border-transparent bg-[rgba(144.67,212.06,122.21,0.20)] font-medium text-[#2F3E33] [box-shadow:0_6px_14px_rgba(165,190,103,0.14),inset_0_1px_0_rgba(255,255,255,0.3)] [backdrop-filter:blur(20px)_saturate(128%)] [-webkit-backdrop-filter:blur(20px)_saturate(128%)] transition-opacity hover:opacity-90';

export const APP_MODAL_SECONDARY_BUTTON_CLASS =
  'rounded-2xl border border-white/70 bg-white/80 font-medium text-[#2F3E33] [box-shadow:0_6px_14px_rgba(165,190,103,0.14),inset_0_1px_0_rgba(255,255,255,0.3)] [backdrop-filter:blur(20px)_saturate(128%)] [-webkit-backdrop-filter:blur(20px)_saturate(128%)] transition-colors hover:bg-white hover:text-[#243129]';

export const APP_SELECTED_GLOW_BG =
  'linear-gradient(135deg, rgba(219,234,254,0.95) 0%, rgba(191,219,254,0.90) 45%, rgba(147,197,253,0.72) 100%) padding-box, linear-gradient(140deg, rgba(147,197,253,0.52) 0%, rgba(239,246,255,0.95) 55%, rgba(255,255,255,0.98) 100%) border-box';

export const APP_SELECTED_GLOW_BORDER =
  '0.5px solid transparent';

export const APP_SELECTED_GLOW_SHADOW =
  '0 6px 14px rgba(59,130,246,0.14)';

export const APP_SELECTED_GLOW_TEXT = '#1D4ED8';

export const APP_GREEN_GLASS_BG =
  'linear-gradient(135deg, rgba(236,244,218,0.92) 0%, rgba(226,239,189,0.9) 44%, rgba(208,230,161,0.88) 100%) padding-box, linear-gradient(140deg, rgba(208,230,161,0.34) 0%, rgba(236,244,218,0.86) 54%, rgba(255,255,255,0.94) 100%) border-box';

export const APP_GREEN_GLASS_BORDER = '0.5px solid transparent';

export const APP_GREEN_GLASS_SHADOW = '0 6px 14px rgba(165,190,103,0.14), inset 0 1px 0 rgba(255,255,255,0.3)';

export const APP_GREEN_GLASS_TEXT = '#426D56';

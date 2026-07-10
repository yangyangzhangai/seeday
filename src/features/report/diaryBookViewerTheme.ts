// DOC-DEPS: src/features/report/README.md, docs/PROJECT_MAP.md
export const ACTIVITY_UI_COLORS = ['#D5E8CE', '#AACBA4', '#85AD80', '#6A9464', '#4E7549'];
export const MOOD_UI_COLORS = ['#F8D0DC', '#F0AABE', '#DE8BA2', '#C46E86'];
export const DIARY_LINE_SOLID = '1px solid rgba(156, 148, 176, 0.24)';
export const DIARY_LINE_DASHED = '1px dashed rgba(156, 148, 176, 0.34)';
export const CUSTOM_MOOD_LABELS = new Set(['自定义', 'Custom', 'Personalizzato']);

export const BASE_PAGE_W = 180;
export const BASE_PAGE_H = 255;
export const FLIP_MS = 550;
export const BASE_SIDE_GAP = 6;
export const MAX_VIS = 4;
export const BASE_HEIGHT_SHRINK = 20;
export const PAPER_COLOR = '#ffffff';
export const SHELF_BG = '#f4f7f4';
export const LEATHER_TEXTURE = 'https://images.unsplash.com/photo-1729823546609-2b113553cdcd?q=80&w=1080';
export const PARCHMENT_TEXTURE = 'https://images.unsplash.com/photo-1719563015025-83946fb49e49?q=80&w=1080';

const COVER_COLORS = ['#7c4a5a', '#4d7a9e', '#8aac8d', '#3d5244', '#b56740', '#9a7a3a', '#5c5e8a', '#3d6b6d'];

export function coverColor(month: Date): string {
  const idx = (month.getFullYear() * 12 + month.getMonth()) % COVER_COLORS.length;
  return COVER_COLORS[idx];
}

export const SPINE_STRIP_W = 14;
export const BASE_SHEET_SPINE_OVERLAP = 2;
export const TRAPEZOID_ANGLE_DEG = Math.atan((BASE_HEIGHT_SHRINK / 2) / BASE_PAGE_W) * (180 / Math.PI);

export function containsHanText(text: string): boolean {
  return /[\u4E00-\u9FFF]/.test(text);
}

export function shouldUseStoredLocalizedSummary(text: string, lang: 'zh' | 'en' | 'it'): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (lang !== 'zh' && containsHanText(trimmed)) return false;
  if (lang === 'zh' && !containsHanText(trimmed)) return false;
  return true;
}

// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/growth/README.md
import type { CSSProperties } from 'react';
import type { GrowthPriority } from '../../store/useTodoStore';

export const GROWTH_PRIORITY_TEXT_CLASS: Record<GrowthPriority, string> = {
  high: 'text-rose-500',
  medium: 'text-amber-500',
  low: 'text-emerald-500',
};

const GROWTH_PRIORITY_SELECTED_STYLE: Record<GrowthPriority, CSSProperties> = {
  high: {
    background:
      'linear-gradient(135deg, rgba(254,247,249,0.98) 0%, rgba(250,231,236,0.95) 12%, rgba(249,224,228,0.93) 58%, rgba(244,210,218,0.95) 100%) padding-box, linear-gradient(140deg, rgba(255,255,255,0.94) 0%, rgba(249,224,228,0.98) 48%, rgba(244,210,218,0.98) 100%) border-box',
    border: '0.5px solid transparent',
    boxShadow: '0 6px 14px rgba(249,224,228,0.42)',
  },
  medium: {
    background:
      'linear-gradient(135deg, rgba(255,255,246,0.98) 0%, rgba(255,255,203,0.95) 12%, rgba(254,255,175,0.93) 58%, rgba(247,248,154,0.95) 100%) padding-box, linear-gradient(140deg, rgba(255,255,255,0.94) 0%, rgba(254,255,175,0.98) 48%, rgba(247,248,154,0.98) 100%) border-box',
    border: '0.5px solid transparent',
    boxShadow: '0 6px 14px rgba(254,255,175,0.42)',
  },
  low: {
    background:
      'linear-gradient(135deg, rgba(248,255,240,0.98) 0%, rgba(236,255,212,0.95) 12%, rgba(228,255,196,0.93) 58%, rgba(210,244,176,0.95) 100%) padding-box, linear-gradient(140deg, rgba(255,255,255,0.94) 0%, rgba(228,255,196,0.98) 48%, rgba(210,244,176,0.98) 100%) border-box',
    border: '0.5px solid transparent',
    boxShadow: '0 6px 14px rgba(228,255,196,0.42)',
  },
};

export function getGrowthPrioritySelectedStyle(priority: GrowthPriority): CSSProperties {
  return GROWTH_PRIORITY_SELECTED_STYLE[priority];
}

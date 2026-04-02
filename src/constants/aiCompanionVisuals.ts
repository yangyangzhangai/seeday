import type { AiCompanionMode } from '../lib/aiCompanion';
import agnesAvatar from '../assets/ai-companions/agnes.png';
import momoAvatar from '../assets/ai-companions/momo.png';
import vanAvatar from '../assets/ai-companions/van.png';
import zepAvatar from '../assets/ai-companions/zep.png';

interface AiCompanionVisual {
  name: string;
  subtitle: string;
  avatar: string;
  free: boolean;
}

export const AI_COMPANION_ORDER: AiCompanionMode[] = ['van', 'agnes', 'zep', 'spring_thunder'];

export const AI_COMPANION_VISUALS: Record<AiCompanionMode, AiCompanionVisual> = {
  van: {
    name: 'Van',
    subtitle: '情绪治愈',
    avatar: vanAvatar,
    free: true,
  },
  agnes: {
    name: 'Agnes',
    subtitle: '引领指导',
    avatar: agnesAvatar,
    free: true,
  },
  zep: {
    name: 'Zep',
    subtitle: '生活真实',
    avatar: zepAvatar,
    free: true,
  },
  spring_thunder: {
    name: 'Momo',
    subtitle: '从容温吞',
    avatar: momoAvatar,
    free: false,
  },
};

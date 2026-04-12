// DOC-DEPS: src/services/README.md
/**
 * soundService — 统一音效管理
 * 所有音效通过此服务播放，支持音量控制、预加载、iOS 解锁。
 *
 * 使用方式：
 *   import { playSound } from '@/services/sound/soundService';
 *   playSound('ding');
 */

export type SoundKey =
  | 'ding'        // 待办完成 / 集满一瓶 / 瓶子加星
  | 'complete'    // 专注计时结束
  | 'bubble'      // 发送消息 / 心情卡片 / 待办卡片
  | 'plantGrow'   // 生成植物
  | 'star'        // 生成习惯/目标星星
  | 'waterDrop';  // AI 回复出现

interface SoundConfig {
  src: string;
  volume: number;
}

const SOUND_CONFIG: Record<SoundKey, SoundConfig> = {
  ding:      { src: '/sounds/ding.mp3',       volume: 0.35 },
  complete:  { src: '/sounds/complete.mp3',   volume: 0.8  },
  bubble:    { src: '/sounds/bubble.mp3',     volume: 0.7  },
  plantGrow: { src: '/sounds/plant-grow.mp3', volume: 0.8  },
  star:      { src: '/sounds/star.mp3',       volume: 0.7  },
  waterDrop: { src: '/sounds/water-drop.mp3', volume: 0.65 },
};

const audioCache = new Map<SoundKey, HTMLAudioElement>();
let unlocked = false;

/** iOS 需要在用户手势内先播放一次空音频解锁 AudioContext */
function ensureUnlocked() {
  if (unlocked || typeof window === 'undefined') return;
  unlocked = true;
  const silentAudio = new Audio();
  silentAudio.src =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAA' +
    'EAAQARAAAAAgABAAIAAABkYXRhAAAAAA==';
  silentAudio.volume = 0;
  void silentAudio.play().catch(() => { /* ignore */ });
}

function getAudio(key: SoundKey): HTMLAudioElement {
  if (audioCache.has(key)) return audioCache.get(key)!;
  const config = SOUND_CONFIG[key];
  const audio = new Audio(config.src);
  audio.volume = config.volume;
  audio.preload = 'auto';
  audioCache.set(key, audio);
  return audio;
}

/** 预加载所有音效（在 App 启动时调用一次） */
export function preloadSounds() {
  if (typeof window === 'undefined') return;
  (Object.keys(SOUND_CONFIG) as SoundKey[]).forEach(getAudio);
}

/** 播放指定音效，失败时静默忽略 */
export function playSound(key: SoundKey) {
  if (typeof window === 'undefined') return;
  ensureUnlocked();
  try {
    const audio = getAudio(key);
    audio.loop = false;
    audio.currentTime = 0;
    void audio.play().catch(() => { /* 用户未授权或静音模式下静默忽略 */ });
  } catch {
    // ignore
  }
}

/** 循环播放指定音效（如植物生长），直到调用 stopSound 停止 */
export function playLoopSound(key: SoundKey) {
  if (typeof window === 'undefined') return;
  ensureUnlocked();
  try {
    const audio = getAudio(key);
    audio.loop = true;
    audio.currentTime = 0;
    void audio.play().catch(() => { /* ignore */ });
  } catch {
    // ignore
  }
}

/** 停止并重置指定音效 */
export function stopSound(key: SoundKey) {
  if (typeof window === 'undefined') return;
  try {
    const audio = audioCache.get(key);
    if (!audio) return;
    audio.loop = false;
    audio.pause();
    audio.currentTime = 0;
  } catch {
    // ignore
  }
}

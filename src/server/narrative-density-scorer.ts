// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/timeshine_doc1_低叙事密度判定规范.docx

import { NARRATIVE_DENSITY_WEIGHTS } from './narrative-density-constants.js';
import type { NarrativeScoreResult } from './narrative-density-types.js';

const ZH_EMOTION_WORDS = ['开心', '高兴', '难过', '烦', '崩溃', '焦虑', '生气', '激动', '无聊', '期待'];
const EN_EMOTION_WORDS = ['happy', 'sad', 'angry', 'anxious', 'excited', 'upset', 'tired', 'bored', 'stressed'];
const IT_EMOTION_WORDS = ['felice', 'triste', 'arrabbiato', 'ansia', 'stanco', 'stressato', 'annoia', 'contento'];
const CONNECTORS = ['因为', '但是', '然后', 'because', 'but', 'then', 'perche', 'ma', 'poi'];

function normalizeText(raw: string): string {
  return String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function detectNarrativeEventKey(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) return 'empty';
  if (/吃饭|吃了|吃/.test(normalized)) return 'eat';
  if (/上课|学习|课堂/.test(normalized)) return 'study';
  if (/睡|睡觉/.test(normalized)) return 'sleep';
  if (/扫地|打扫|清洁/.test(normalized)) return 'clean';
  return normalized.slice(0, 20);
}

function scoreFreshness(recentCount7d: number): number {
  if (recentCount7d <= 0) return 1;
  if (recentCount7d <= 2) return 0.7;
  if (recentCount7d <= 5) return 0.3;
  return 0;
}

function scoreDensity(text: string): number {
  const len = text.replace(/\s+/g, '').length;
  const base = len <= 4 ? 0.1 : len <= 10 ? 0.3 : len <= 20 ? 0.6 : 1;
  const hasConnector = CONNECTORS.some((token) => text.toLowerCase().includes(token));
  return Math.min(1, base + (hasConnector ? 0.1 : 0));
}

function scoreEmotion(text: string): number {
  const normalized = text.toLowerCase();
  const lexicon = [...ZH_EMOTION_WORDS, ...EN_EMOTION_WORDS, ...IT_EMOTION_WORDS];
  const hits = lexicon.filter((word) => normalized.includes(word)).length;
  const base = hits <= 0 ? 0.1 : hits === 1 ? 0.5 : 0.9;
  const punctuationBonus = /[!?？！]/.test(normalized) ? 0.1 : 0;
  return Math.min(1, base + punctuationBonus);
}

function scoreVocab(text: string): number {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length <= 1) return 0.1;
  if (/[在去来到于]|\b(in|at|to|from|con|a)\b/.test(normalized)) return 0.8;
  const tokens = normalized.split(/[\s,.;，。；!?？！]+/).filter(Boolean);
  if (tokens.length <= 2) return 0.1;
  return tokens.length <= 4 ? 0.4 : 0.8;
}

export function evaluateNarrativeDensity(inputText: string, recentEventCount7d: number): NarrativeScoreResult {
  const text = String(inputText || '');
  const freshness = scoreFreshness(recentEventCount7d);
  const density = scoreDensity(text);
  const emotion = scoreEmotion(text);
  const vocab = scoreVocab(text);
  const currentScore =
    freshness * NARRATIVE_DENSITY_WEIGHTS.freshness +
    density * NARRATIVE_DENSITY_WEIGHTS.density +
    emotion * NARRATIVE_DENSITY_WEIGHTS.emotion +
    vocab * NARRATIVE_DENSITY_WEIGHTS.vocab;

  return {
    eventKey: detectNarrativeEventKey(text),
    recentEventCount7d,
    currentScore,
    dimensions: { freshness, density, emotion, vocab },
  };
}

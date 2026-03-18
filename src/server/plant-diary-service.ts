// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/TimeShine_植物生长_技术实现文档_v1.7.docx
import { removeThinkingTags } from '../lib/aiParser.js';
import type { PlantCategoryKey, PlantDiaryRequest } from '../types/plant.js';

export interface PlantDiaryServiceInput extends PlantDiaryRequest {
  userName?: string;
}

export interface PlantDiaryServiceResult {
  diaryText: string;
  diaryStatus: 'ready' | 'fallback';
}

const CATEGORY_LABELS: Record<PlantCategoryKey, string> = {
  entertainment: 'entertainment',
  social: 'social',
  work_study: 'work and study',
  exercise: 'exercise',
  life: 'daily life',
};

const FALLBACK_BY_LANG = {
  zh: '今天的植物悄悄记录了你的每一步，根在土里稳稳延伸，明天会长出新的故事。',
  en: 'Your plant quietly captured each step today. The roots held steady, and tomorrow can unfold into a new story.',
  it: 'La tua pianta ha custodito ogni passo di oggi. Le radici hanno tenuto saldo il terreno, e domani potra nascere una nuova storia.',
} as const;

function fallbackDiary(lang: 'zh' | 'en' | 'it' = 'zh'): string {
  return FALLBACK_BY_LANG[lang] ?? FALLBACK_BY_LANG.zh;
}

function buildPrompt(input: PlantDiaryServiceInput): string {
  const topActivities = [...input.activities]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5)
    .map(item => `- ${CATEGORY_LABELS[item.category]}: ${item.duration}min, focus=${item.focus}`)
    .join('\n');

  return [
    'You are writing a warm daily plant diary.',
    'Constraints:',
    '- 150-220 Chinese characters if lang=zh; 120-180 words otherwise.',
    '- Keep tone gentle and observant, avoid judgment.',
    '- Do not include markdown headers.',
    `Date: ${input.date}`,
    `Root type: ${input.rootType}`,
    `Plant stage: ${input.plantStage}`,
    `Is special day: ${input.isSpecial ? 'yes' : 'no'}`,
    `Support variant: ${input.isSupportVariant ? 'yes' : 'no'}`,
    `Total duration: ${input.totalDuration} minutes`,
    'Activities:',
    topActivities || '- none',
  ].join('\n');
}

async function runDiaryRequest(input: PlantDiaryServiceInput, timeoutMs: number): Promise<string> {
  const apiKey = process.env.CHUTES_API_KEY;
  if (!apiKey) {
    throw new Error('Missing CHUTES_API_KEY');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://llm.chutes.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-235B-A22B-Instruct-2507-TEE',
        messages: [
          {
            role: 'system',
            content: 'Write a warm plant diary entry with emotional safety and no negative wording.',
          },
          {
            role: 'user',
            content: buildPrompt(input),
          },
        ],
        temperature: 0.85,
        max_tokens: 520,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Diary API failed: ${response.status} ${text}`);
    }

    const payload = await response.json();
    const content = removeThinkingTags(payload.choices?.[0]?.message?.content || '').trim();
    if (!content) {
      throw new Error('Empty diary content');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function generatePlantDiaryWithFallback(input: PlantDiaryServiceInput): Promise<PlantDiaryServiceResult> {
  const lang = input.lang ?? 'zh';
  const attempts = [5000, 3500];

  for (const timeoutMs of attempts) {
    try {
      const diaryText = await runDiaryRequest(input, timeoutMs);
      return {
        diaryText,
        diaryStatus: 'ready',
      };
    } catch {
      // continue next attempt
    }
  }

  return {
    diaryText: fallbackDiary(lang),
    diaryStatus: 'fallback',
  };
}

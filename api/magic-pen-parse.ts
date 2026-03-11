// DOC-DEPS: LLM.md -> docs/MAGIC_PEN_CAPTURE_SPEC.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';

type MagicPenKind = 'activity_backfill' | 'todo_add';
type MagicPenConfidence = 'high' | 'medium' | 'low';

interface MagicPenAISegment {
  text: string;
  sourceText: string;
  kind: MagicPenKind;
  confidence: MagicPenConfidence;
  startTime?: string;
  endTime?: string;
  timeSource?: 'exact' | 'period' | 'missing';
  periodLabel?: string;
}

interface MagicPenAIResult {
  segments: MagicPenAISegment[];
  unparsed: string[];
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MAGIC_PEN_PROMPT = `你是一个时间记录助手的文本解析器。
你需要拆分输入文本，并输出严格 JSON，不要输出任何解释。

输出结构:
{
  "segments": [
    {
      "text": "核心内容",
      "sourceText": "原始片段",
      "kind": "activity_backfill 或 todo_add",
      "confidence": "high 或 medium 或 low",
      "startTime": "HH:mm，可选",
      "endTime": "HH:mm，可选",
      "timeSource": "exact 或 period 或 missing，可选",
      "periodLabel": "时段词，可选"
    }
  ],
  "unparsed": ["无法分类片段"]
}

规则:
1) activity_backfill 表示今天已发生活动；todo_add 表示未来要做事项。
2) 对 activity_backfill 尽量提取时间:
   - exact: 精确时间或区间
   - period: 上午09:00-11:00，中午12:00-13:00，下午15:00-17:00，晚上20:00-21:00
   - missing: 无法提取时间
3) text 要去掉时间词，保留可读动作内容。
4) 不确定就放 unparsed，不要强行归类。
5) 今天日期 {{todayDateStr}}，当前小时 {{currentHour}}。`;

function isKind(value: unknown): value is MagicPenKind {
  return value === 'activity_backfill' || value === 'todo_add';
}

function isConfidence(value: unknown): value is MagicPenConfidence {
  return value === 'high' || value === 'medium' || value === 'low';
}

function sanitizeSegment(segment: unknown): MagicPenAISegment | null {
  if (!segment || typeof segment !== 'object') return null;
  const record = segment as Record<string, unknown>;
  const kind = record.kind;
  if (!isKind(kind)) return null;

  const text = typeof record.text === 'string' ? record.text.trim() : '';
  const sourceText = typeof record.sourceText === 'string' ? record.sourceText.trim() : text;
  if (!text && !sourceText) return null;

  const confidence = isConfidence(record.confidence) ? record.confidence : 'low';

  const startTime = typeof record.startTime === 'string' && TIME_RE.test(record.startTime)
    ? record.startTime
    : undefined;
  const endTime = typeof record.endTime === 'string' && TIME_RE.test(record.endTime)
    ? record.endTime
    : undefined;
  const timeSource = record.timeSource === 'exact' || record.timeSource === 'period' || record.timeSource === 'missing'
    ? record.timeSource
    : undefined;
  const periodLabel = typeof record.periodLabel === 'string' ? record.periodLabel : undefined;

  return {
    text: text || sourceText,
    sourceText: sourceText || text,
    kind,
    confidence,
    startTime,
    endTime,
    timeSource,
    periodLabel,
  };
}

function normalizeAIResult(input: unknown): MagicPenAIResult {
  if (!input || typeof input !== 'object') {
    return { segments: [], unparsed: ['（AI 解析失败，请手动录入）'] };
  }
  const payload = input as Record<string, unknown>;
  const segments = Array.isArray(payload.segments)
    ? payload.segments.map(sanitizeSegment).filter((item): item is MagicPenAISegment => !!item)
    : [];
  const unparsed = Array.isArray(payload.unparsed)
    ? payload.unparsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
  return { segments, unparsed };
}

function parseMagicPenAIResponse(raw: string): MagicPenAIResult {
  try {
    return normalizeAIResult(JSON.parse(raw.trim()));
  } catch {
    // noop
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return normalizeAIResult(JSON.parse(match[0]));
    } catch {
      // noop
    }
  }

  return { segments: [], unparsed: ['（AI 解析失败，请手动录入）'] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);
  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const {
    rawText,
    todayDateStr,
    currentHour,
  } = req.body ?? {};

  if (!rawText || typeof rawText !== 'string') {
    jsonError(res, 400, 'Missing or invalid rawText');
    return;
  }
  if (!todayDateStr || typeof todayDateStr !== 'string') {
    jsonError(res, 400, 'Missing or invalid todayDateStr');
    return;
  }
  if (!Number.isInteger(currentHour) || currentHour < 0 || currentHour > 23) {
    jsonError(res, 400, 'Missing or invalid currentHour');
    return;
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    jsonError(res, 500, 'Server configuration error: Missing API key');
    return;
  }

  const prompt = MAGIC_PEN_PROMPT
    .replace('{{todayDateStr}}', todayDateStr)
    .replace('{{currentHour}}', String(currentHour));

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'glm-4.7-flash',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: rawText },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      jsonError(res, response.status, `AI service error: ${response.statusText}`, errorText);
      return;
    }

    const json = await response.json();
    const raw = json?.choices?.[0]?.message?.content || '';
    const data = parseMagicPenAIResponse(raw);

    res.status(200).json({ success: true, data, raw });
  } catch (error) {
    jsonError(res, 500, 'Internal server error', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}

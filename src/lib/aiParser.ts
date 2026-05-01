export type CommentLang = 'zh' | 'en' | 'it';

const COMMENT_ANCHORS = [
  '无前缀。',
  '不要复述上面的任何内容',
  '你的批注内容"}',
  '直接以你的风格输出',
  '【最近批注】',
  'senza prefissi.',
  'without prefixes.',
  'IMPORTANTE:',
  'IMPORTANT:',
];

const LEAK_KEYWORDS = [
  'activity_recorded',
  'activity_completed',
  'mood_recorded',
  '【刚刚发生】',
  '【今日时间线】',
  '【最近批注】',
  '直接以你的风格输出',
  '无前缀',
  '"comment"',
  'JSON',
  '15-60字',
  '批注文本',
  '输出格式',
  '系统提示词',
  '【批注】',
  '【Appena Successo】',
  '【Timeline di Oggi】',
  '【Annotazioni Recenti】',
  '【Just Happened】',
  "【Today's Timeline】",
  '【Recent Annotations】',
];

export function removeThinkingTags(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\s+[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/&lt;think&gt;[\s\S]*?&lt;\/think&gt;/gi, '')
    .replace(/<\?\?>[\s\S]*?<\?\?>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<output>[\s\S]*?<\/output>/gi, '');

  if (cleaned.includes('<think>')) {
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
  }

  return cleaned.trim();
}

export function isValidComment(text: string, lang: CommentLang = 'zh'): boolean {
  if (!text) return false;

  if (lang === 'zh') {
    if (text.length < 15 || text.length > 80) return false;
  } else {
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 7 || wordCount > 45) return false;
  }

  for (const kw of LEAK_KEYWORDS) {
    if (text.includes(kw)) return false;
  }

  return true;
}

export function extractComment(rawText: string, lang: CommentLang = 'zh'): string | null {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }

  const text = rawText.trim();

  if (isValidComment(text, lang)) {
    return text;
  }

  try {
    const jsonBlocks = [...text.matchAll(/\{[^{}]*"comment"\s*:\s*"(?:[^"\\]|\\.)*"[^{}]*\}/g)];
    if (jsonBlocks.length > 0) {
      const lastBlock = jsonBlocks[jsonBlocks.length - 1][0];
      const parsed = JSON.parse(lastBlock);
      if (parsed.comment && typeof parsed.comment === 'string' && isValidComment(parsed.comment, lang)) {
        return parsed.comment.trim();
      }
    }
  } catch {
    if (import.meta.env.DEV) console.warn('[JSON解析失败] 降级到策略二');
  }

  for (const anchor of COMMENT_ANCHORS) {
    const idx = text.lastIndexOf(anchor);
    if (idx === -1) continue;

    const after = text.slice(idx + anchor.length).trim();
    const cleaned = after
      .replace(/^\s*\{?\s*"?comment"?\s*:\s*"?/, '')
      .replace(/"?\s*\}?\s*$/, '')
      .replace(/^["']/, '')
      .replace(/["']$/, '')
      .trim();

    if (isValidComment(cleaned, lang)) {
      return cleaned;
    }
  }

  const sentences = text
    .split(/[。！!？?\n]/)
    .map(s => s.trim())
    .filter(s => s.length >= 10 && s.length <= 100);

  if (sentences.length > 0) {
    const lastSentence = sentences[sentences.length - 1];
    if (isValidComment(lastSentence, lang)) {
      return lastSentence;
    }
  }

  if (import.meta.env.DEV) console.error('[提取失败] 原始内容:', rawText);
  return null;
}

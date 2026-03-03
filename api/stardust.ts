import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function - Stardust Emoji API
 * 调用 Chutes AI 为 Stardust 珍藏生成 Emoji 字符
 *
 * POST /api/stardust
 * Body: { userRawContent: string, message: string }
 * Response: { emojiChar: string }
 */

const DEFAULT_EMOJI = '✨';

// Unicode Extended_Pictographic — 覆盖组合 emoji / 旗帜 / 变体符号
const EMOJI_RE = /\p{Extended_Pictographic}/u;

/**
 * 从 AI 响应中提取第一个 Emoji 字符
 */
function extractEmoji(content: string | null | undefined): string | null {
    if (!content || typeof content !== 'string') return null;

    const trimmed = content.trim();
    if (!trimmed) return null;

    // 宽范围 Emoji 正则（代码点范围）
    const emojiRegex =
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{25B6}]|[\u{25C0}]|[\u{2614}-\u{2615}]|[\u{2648}-\u{2653}]|[\u{267F}]|[\u{2693}]|[\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{270D}]|[\u{2714}]|[\u{2728}]|[\u{274C}]|[\u{274E}]|[\u{2757}]|[\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{2B50}]|[\u{2B55}]/gu;

    const matches = trimmed.match(emojiRegex);
    if (matches && matches.length > 0) {
        return matches[0];
    }

    // 兜底：若 AI 整体返回就是一个短字符，直接返回
    const cleaned = trimmed.replace(/^["'`（(「【『]+|["'`）)」】』]+$/g, '');
    if (cleaned.length > 0 && cleaned.length <= 8 && EMOJI_RE.test(cleaned)) {
        return cleaned;
    }

    return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { userRawContent, message } = req.body || {};

    if (!userRawContent && !message) {
        res.status(400).json({ error: 'Missing userRawContent or message' });
        return;
    }

    const apiKey = process.env.CHUTES_API_KEY;

    // 若无 API Key，直接返回默认 Emoji（不报错）
    if (!apiKey) {
        console.warn('[Stardust API] CHUTES_API_KEY 未配置，使用默认 Emoji');
        res.status(200).json({ emojiChar: DEFAULT_EMOJI });
        return;
    }

    const prompt = `Based on the following user activity and AI annotation, choose a single Unicode Emoji character that best represents this emotional moment.

User Activity/Mood: ${userRawContent || 'None'}
AI Annotation: ${message || 'None'}

Rules:
1. Choose an emoji with clear, specific imagery (e.g. 🌙🌟🫧🕊️) and avoid generic basic symbols (e.g. ❤️😊).
2. ONLY output ONE single Emoji character. No markdown, no explanations, no other text.
3. Choose a symbol that evokes a poetic and visual feeling.

Output: exactly one string character.`;

    try {
        const response = await fetch('https://llm.chutes.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'NousResearch/Hermes-4-405B-FP8-TEE',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are an Emoji selector. Based on emotional content, output ONE single Unicode Emoji. No text, no explanation.',
                    },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.7,
                max_tokens: 10,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Stardust API] AI error:', response.status, errorText);
            res.status(200).json({ emojiChar: DEFAULT_EMOJI });
            return;
        }

        const data = await response.json();
        const rawContent = data?.choices?.[0]?.message?.content;

        console.log('[Stardust API] AI 原始响应:', rawContent);

        const emoji = extractEmoji(rawContent);
        if (emoji) {
            console.log('[Stardust API] 提取 Emoji 成功:', emoji);
            res.status(200).json({ emojiChar: emoji });
        } else {
            console.warn('[Stardust API] 无法提取 Emoji，使用默认值');
            res.status(200).json({ emojiChar: DEFAULT_EMOJI });
        }
    } catch (error) {
        console.error('[Stardust API] 调用失败:', error);
        res.status(200).json({ emojiChar: DEFAULT_EMOJI });
    }
}

// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, handlePreflight, jsonError, requireMethod } from './http.js';

/**
 * Vercel Serverless Function - Chat API
 * 调用 Chutes AI (Hermes-4-405B-FP8-TEE) 进行对话
 * 
 * POST /api/chat
 * Body: { messages: [{ role: string, content: string }], temperature?: number, max_tokens?: number }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, ['POST']);

  if (handlePreflight(req, res)) return;
  if (!requireMethod(req, res, 'POST')) return;

  const { messages, temperature = 0.9, max_tokens = 512 } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    jsonError(res, 400, 'Missing or invalid messages');
    return;
  }

  const apiKey = process.env.CHUTES_API_KEY;
  if (!apiKey) {
    jsonError(res, 500, 'Server configuration error: Missing API key');
    return;
  }

  try {
    const response = await fetch('https://llm.chutes.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'NousResearch/Hermes-4-405B-FP8-TEE',
        messages,
        temperature,
        max_tokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Chutes API error:', response.status, errorText);
      jsonError(res, response.status, `AI service error: ${response.statusText}`, errorText);
      return;
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      jsonError(res, 502, 'Empty response from AI service');
      return;
    }

    const content = data.choices[0]?.message?.content;
    if (!content) {
      jsonError(res, 502, 'Empty content from AI service');
      return;
    }

    res.status(200).json({ 
      content: content.trim(),
      model: data.model,
      usage: data.usage
    });
  } catch (error) {
    console.error('Chat API error:', error);
    jsonError(res, 500, 'Internal server error', undefined, error instanceof Error ? error.message : 'Unknown error');
  }
}

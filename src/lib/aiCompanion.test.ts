import { describe, expect, it } from 'vitest';
import { getSystemPrompt } from '../server/annotation-prompts';
import { buildAiCompanionModePrompt, normalizeAiCompanionMode } from './aiCompanion';

describe('aiCompanion', () => {
  it('falls back to van for unknown modes', () => {
    expect(normalizeAiCompanionMode('unknown')).toBe('van');
  });

  it('builds localized companion guidance for diary prompts', () => {
    const prompt = buildAiCompanionModePrompt('zh', 'agnes', 'diary');

    expect(prompt).toContain('Agnes - 引领指导');
    expect(prompt).toContain('【日记写作重点】');
    expect(prompt).toContain('方向');
  });

  it('builds annotation guidance for spring thunder in english', () => {
    const prompt = buildAiCompanionModePrompt('en', 'spring_thunder', 'annotation');

    expect(prompt).toContain('Spring Thunder - Order Catalyst');
    expect(prompt).toContain('Annotation priorities:');
    expect(prompt).toContain('one strike is enough');
  });

  it('injects the selected mode into annotation system prompts', () => {
    const prompt = getSystemPrompt('en', 'zep');

    expect(prompt).toContain('Zep - Real-Life Candor');
    expect(prompt).toContain('sharp friend who actually lives on Earth');
  });
});

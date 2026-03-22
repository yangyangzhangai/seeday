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

  it('uses dedicated english annotation prompts for van, agnes, and zep', () => {
    const vanPrompt = buildAiCompanionModePrompt('en', 'van', 'annotation');
    const agnesPrompt = buildAiCompanionModePrompt('en', 'agnes', 'annotation');
    const zepPrompt = buildAiCompanionModePrompt('en', 'zep', 'annotation');

    expect(vanPrompt).toContain('# Van - "Another Me"');
    expect(agnesPrompt).toContain('# Agnes - "Ancient Dragon Tree"');
    expect(zepPrompt).toContain('# Zep - "Pelican in the Greenhouse"');
    expect(vanPrompt).not.toContain('Annotation priorities:');
  });

  it('uses dedicated italian annotation prompts for van, agnes, and zep', () => {
    const vanPrompt = buildAiCompanionModePrompt('it', 'van', 'annotation');
    const agnesPrompt = buildAiCompanionModePrompt('it', 'agnes', 'annotation');
    const zepPrompt = buildAiCompanionModePrompt('it', 'zep', 'annotation');

    expect(vanPrompt).toContain('# Van - "Un Altro Me"');
    expect(agnesPrompt).toContain('# Agnes - "Dracena Antica"');
    expect(zepPrompt).toContain('# Zep - "Pellicano nella Serra"');
    expect(vanPrompt).not.toContain("Priorita dell'annotazione:");
  });

  it('uses the dedicated chinese annotation prompt when one is defined', () => {
    const prompt = buildAiCompanionModePrompt('zh', 'van', 'annotation');

    expect(prompt).toContain('# Van');
  });

  it('injects the selected mode into annotation system prompts', () => {
    const prompt = getSystemPrompt('en', 'zep');

    expect(prompt).toContain('# Zep - "Pelican in the Greenhouse"');
    expect(prompt).toContain('One short annotation only.');
  });
});

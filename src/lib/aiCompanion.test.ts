import { describe, expect, it } from 'vitest';
import { getSystemPrompt } from '../server/annotation-prompts';
import { buildAiCompanionModePrompt, normalizeAiCompanionMode } from './aiCompanion';

describe('aiCompanion', () => {
  it('falls back to van for unknown modes', () => {
    expect(normalizeAiCompanionMode('unknown')).toBe('van');
  });

  it('builds localized companion guidance for diary prompts', () => {
    const prompt = buildAiCompanionModePrompt('zh', 'agnes', 'diary');

    expect(prompt).toContain('你是Agnes');
    expect(prompt).toContain('正文必须 150-300 字');
    expect(prompt).toContain('成长/状态变化信号');
  });

  it('uses dedicated english annotation prompt for momo', () => {
    const prompt = buildAiCompanionModePrompt('en', 'momo', 'annotation');

    expect(prompt).toContain('You are Momo, a tiny mushroom living in the time greenhouse.');
    expect(prompt).toContain('Core stance: hold, do not push');
    expect(prompt).toContain('Exactly one emoji at the end');
  });

  it('uses dedicated english annotation prompts for van, agnes, and zep', () => {
    const vanPrompt = buildAiCompanionModePrompt('en', 'van', 'annotation');
    const agnesPrompt = buildAiCompanionModePrompt('en', 'agnes', 'annotation');
    const zepPrompt = buildAiCompanionModePrompt('en', 'zep', 'annotation');

    expect(vanPrompt).toContain('You are Van, a morning glory living in the time greenhouse.');
    expect(agnesPrompt).toContain('You are Agnes, a thousand-year dragon tree living in the time greenhouse.');
    expect(zepPrompt).toContain('You are Zep, a pelican living in the time greenhouse.');
    expect(vanPrompt).not.toContain('Annotation priorities:');
  });

  it('uses dedicated italian annotation prompts for van, agnes, and zep', () => {
    const vanPrompt = buildAiCompanionModePrompt('it', 'van', 'annotation');
    const agnesPrompt = buildAiCompanionModePrompt('it', 'agnes', 'annotation');
    const zepPrompt = buildAiCompanionModePrompt('it', 'zep', 'annotation');

    expect(vanPrompt).toContain('Sei Van, una campanula che vive nella serra del tempo.');
    expect(agnesPrompt).toContain('Sei Agnes, una dracena millenaria che vive nella serra del tempo.');
    expect(zepPrompt).toContain('Sei Zep, un pellicano che vive nella serra del tempo.');
    expect(vanPrompt).not.toContain("Priorita dell'annotazione:");
  });

  it('uses the dedicated chinese annotation prompt when one is defined', () => {
    const prompt = buildAiCompanionModePrompt('zh', 'van', 'annotation');

    expect(prompt).toContain('你是 Van');
  });

  it('injects the selected mode into annotation system prompts', () => {
    const prompt = getSystemPrompt('en', 'zep');

    expect(prompt).toContain('You are Zep');
    expect(prompt).toContain('Exactly one emoji at the end.');
  });

  it('routes en/it annotation system prompts to dedicated mode prompts (no concatenated fallback blocks)', () => {
    const enPrompt = getSystemPrompt('en', 'van');
    const itPrompt = getSystemPrompt('it', 'agnes');

    expect(enPrompt).not.toContain('Annotation priorities:');
    expect(itPrompt).not.toContain("Priorita dell'annotazione:");
  });
});

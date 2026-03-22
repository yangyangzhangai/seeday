import { describe, expect, it } from 'vitest';
import { classifyLiveInput } from './liveInputClassifier';
import type { LiveInputContext } from './types';

const baseContext: LiveInputContext = { now: Date.now() };

function classify(content: string, context: LiveInputContext = baseContext) {
  return classifyLiveInput(content, context);
}

describe('classifyLiveInput en/it baseline regressions', () => {
  it('classifies English standalone mood: I feel tired', () => {
    const result = classify('I feel tired');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies English standalone mood with added slang: I am frazzled', () => {
    const result = classify('I am frazzled');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies English standalone mood with added anxious term: I feel jittery', () => {
    const result = classify('I feel jittery');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies English daily down phrase: I feel sad', () => {
    const result = classify('I feel sad');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies English daily positive phrase: I feel good', () => {
    const result = classify('I feel good');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies English colloquial down phrase: I am pissed off', () => {
    const result = classify('I am pissed off');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies English activity: I am working', () => {
    const result = classify('I am working');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English generic study object: studying corporate finance', () => {
    const result = classify('Studying corporate finance');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English generic review object: reviewing probability statistics', () => {
    const result = classify('Reviewing probability statistics');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English social slang activity: grabbing lunch with friends', () => {
    const result = classify('Grabbing lunch with friends');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English entertainment activity: watching anime', () => {
    const result = classify('Watching anime');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English daily activity: reading the newspaper', () => {
    const result = classify('Reading the newspaper');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English natural activity: just got home', () => {
    const result = classify('Just got home');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English natural activity: went for a run', () => {
    const result = classify('Went for a run');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English natural activity: done with work', () => {
    const result = classify('Done with work');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English natural activity: out for coffee', () => {
    const result = classify('Out for coffee');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English work shell activity: deep in a doc', () => {
    const result = classify('deep in a doc');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English study shell activity even with tomorrow cue: cramming for my exam tomorrow', () => {
    const result = classify('cramming for my exam tomorrow');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English life shell activity: doing the dishes', () => {
    const result = classify('doing the dishes');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies English short activity shell fallback: buy veggies', () => {
    const result = classify('buy veggies');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
    expect(result.reasons).toContain('short_non_mood_default_to_activity_latin');
  });

  it('keeps English emo slang as mood, not short activity fallback', () => {
    const result = classify('emo');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
    expect(result.reasons).not.toContain('short_non_mood_default_to_activity_latin');
  });

  it('classifies English mood about last activity with context', () => {
    const result = classify('the meeting was stressful', {
      now: Date.now(),
      recentActivity: {
        id: 'a-meeting-en',
        content: 'meeting',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-meeting-en');
  });

  it('classifies English mood_about_last_activity with causal evaluation phrasing', () => {
    const result = classify('that phone call made me anxious', {
      now: Date.now(),
      recentActivity: {
        id: 'a-call-en',
        content: 'phone call with client',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-call-en');
  });

  it('classifies English repeated activity+mood as mood_about_last_activity with context overlap', () => {
    const result = classify('reading the newspaper feels good', {
      now: Date.now(),
      recentActivity: {
        id: 'a-news-en',
        content: 'reading the newspaper',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-news-en');
  });

  it('classifies English activity_with_mood: just finished report, relieved', () => {
    const result = classify('Just finished the report, relieved');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('classifies English activity_with_mood from natural mixed sentence: back-to-back meetings all morning, exhausted', () => {
    const result = classify('back-to-back meetings all morning, exhausted');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('keeps English book phrases as activity instead of ok/good substring mood hits', () => {
    const result = classify('Reading a good book');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('keeps ambiguous English mood words phrase-based: I am doing okay', () => {
    const result = classify('I am doing okay');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('keeps English evaluation phrase as mood: dreading the meeting', () => {
    const result = classify('dreading the meeting');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('keeps English depleted idiom as mood: running on fumes', () => {
    const result = classify('running on fumes');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('keeps English future plan sentence out of activity: later I will go to the gym', () => {
    const result = classify('Later I will go to the gym');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('does not link to unrelated recent context by raw substring in English', () => {
    const result = classify('I just wrapped up the report, exhausted', {
      now: Date.now(),
      recentActivity: {
        id: 'a-meeting-only',
        content: 'team meeting',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('classifies English last-activity evaluation: that presentation went really well', () => {
    const result = classify('that presentation went really well', {
      now: Date.now(),
      recentActivity: {
        id: 'a-presentation-en',
        content: 'preparing a presentation',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-presentation-en');
  });

  it('classifies English last-activity evaluation with overlap stemming: commute was rough today', () => {
    const result = classify('commute was rough today', {
      now: Date.now(),
      recentActivity: {
        id: 'a-commute-en',
        content: 'commuting',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-commute-en');
  });

  it('classifies Italian standalone mood: sono stanco', () => {
    const result = classify('sono stanco');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian standalone mood with added phrase: sono giu di morale', () => {
    const result = classify('sono giu di morale');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian standalone mood with added low-energy term: mi sento svuotato', () => {
    const result = classify('mi sento svuotato');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian daily down phrase: mi sento triste', () => {
    const result = classify('mi sento triste');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian daily positive phrase: mi sento bene', () => {
    const result = classify('mi sento bene');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian colloquial down phrase: sono scazzato', () => {
    const result = classify('sono scazzato');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian activity: sto studiando', () => {
    const result = classify('sto studiando');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian short activity shell fallback: bollire acqua', () => {
    const result = classify('bollire acqua');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
    expect(result.reasons).toContain('short_non_mood_default_to_activity_latin');
  });

  it('keeps Italian emo slang as mood, not short activity fallback', () => {
    const result = classify('sono emo');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
    expect(result.reasons).not.toContain('short_non_mood_default_to_activity_latin');
  });

  it('keeps planned Italian sentence out of activity: domani voglio correre', () => {
    const result = classify('domani voglio correre');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });

  it('classifies Italian generic study object: sto studiando finanza aziendale', () => {
    const result = classify('Sto studiando finanza aziendale');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian generic review object: ripasso statistica', () => {
    const result = classify('Ripasso statistica');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian social activity: prendo pranzo con un amico', () => {
    const result = classify('Prendo pranzo con un amico');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian entertainment activity: guardo anime', () => {
    const result = classify('Guardo anime');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian daily activity: leggo il giornale', () => {
    const result = classify('Leggo il giornale');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('new_activity');
  });

  it('classifies Italian activity_with_mood: ho appena finito la riunione, sono sollevato', () => {
    const result = classify('Ho appena finito la riunione, sono sollevato');
    expect(result.kind).toBe('activity');
    expect(result.internalKind).toBe('activity_with_mood');
  });

  it('classifies Italian mood_about_last_activity with causal mood phrasing', () => {
    const result = classify('quella lezione mi ha confuso', {
      now: Date.now(),
      recentActivity: {
        id: 'a-lesson-it',
        content: 'lezione',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-lesson-it');
  });

  it('classifies Italian repeated activity+mood as mood_about_last_activity with context overlap', () => {
    const result = classify('leggo il giornale e mi sento bene', {
      now: Date.now(),
      recentActivity: {
        id: 'a-news-it',
        content: 'leggo il giornale',
        timestamp: Date.now() - 5 * 60 * 1000,
        isOngoing: false,
      },
    });
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('mood_about_last_activity');
    expect(result.relatedActivityId).toBe('a-news-it');
  });

  it('keeps Italian future plan sentence out of activity: stasera ho intenzione di andare in palestra', () => {
    const result = classify('Stasera ho intenzione di andare in palestra');
    expect(result.kind).toBe('mood');
    expect(result.internalKind).toBe('standalone_mood');
  });
});

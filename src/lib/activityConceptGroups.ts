// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> docs/ACTIVITY_LEXICON.md
//
// Concept-group semantic expansion for bottleMatcher.
// Each group maps a set of canonical habit/goal bottle names to regex patterns
// that match user input expressions for the same activity.
// Used as a fallback when direct keyword matching fails.
//
// Data authoring rules:
// 1. concepts[] must be multi-char (≥2) to avoid over-broad matches.
// 2. patterns[] must be specific enough to avoid cross-category false positives.
// 3. When adding a new group, test against 5 positive and 3 negative examples.

export interface ActivityConceptGroup {
  /** Canonical terms likely used as bottle/goal names */
  concepts: readonly string[];
  /** Regex patterns that match user input describing this activity */
  patterns: readonly RegExp[];
}

export const ACTIVITY_CONCEPT_GROUPS: readonly ActivityConceptGroup[] = [

  // ── ZH ─────────────────────────────────────────────────────────────────────

  {
    concepts: ['阅读', '读书', '看书'],
    patterns: [
      /看[了过]?[^\s]{0,6}(书|小说|漫画|课外书)/,
      /读[了过]?[^\s]{0,6}(书|小说|文章|章节|页)/,
      /翻[了]?书/,
      /看完[了]?.*(书|小说)/,
      /读完[了]?.*(书|小说)/,
    ],
  },

  {
    concepts: ['跑步', '晨跑', '夜跑', '长跑'],
    patterns: [
      /跑[了步完]/,
      /出去跑/,
      /去跑步?/,
    ],
  },

  {
    concepts: ['健身', '运动', '锻炼'],
    patterns: [
      /去健身/,
      /健了身/,
      /撸了铁/,
      /练了[^\s]{0,10}/,
      /去运动/,
      /锻炼了/,
    ],
  },

  {
    concepts: ['冥想', '正念'],
    patterns: [
      /冥想了?/,
      /打坐了?/,
      /呼吸练习/,
      /正念[练习]?/,
    ],
  },

  {
    concepts: ['写作', '写日记', '记日记'],
    patterns: [
      /写[了]?日记/,
      /记[了]?日记/,
      /写[了]?\d+字/,
    ],
  },

  {
    concepts: ['画画', '绘画', '素描'],
    patterns: [
      /画[了]?[一\d][幅张]/,
      /画[了]?.*(图|画)/,
      /素描了?/,
    ],
  },

  // ── EN ─────────────────────────────────────────────────────────────────────

  {
    concepts: ['reading', 'read'],
    patterns: [
      /read (a|the|some|one|\d+).*(book|chapter|page|novel|comic)/i,
      /finished (reading|a book)/i,
      /flipped through/i,
    ],
  },

  {
    concepts: ['running', 'jogging', 'morning run', 'evening run'],
    patterns: [
      /went for a run/i,
      /ran \d/i,
      /(morning|evening|night) run/i,
      /ran (outside|today|this morning)/i,
    ],
  },

  {
    concepts: ['workout', 'gym', 'exercise'],
    patterns: [
      /hit the gym/i,
      /worked out/i,
      /lifted weights/i,
      /strength training/i,
    ],
  },

  {
    concepts: ['meditation', 'mindfulness'],
    patterns: [
      /meditated/i,
      /meditation session/i,
      /breathing exercise/i,
      /mindfulness practice/i,
    ],
  },

  // ── IT ─────────────────────────────────────────────────────────────────────

  {
    concepts: ['lettura', 'leggere'],
    patterns: [
      /ho letto/i,
      /letto (un|il|la)/i,
      /leggendo (un|il|la)/i,
    ],
  },

  {
    concepts: ['corsa', 'correre'],
    patterns: [
      /ho corso/i,
      /corsa (mattutina|serale)/i,
      /sono andato a correre/i,
    ],
  },
];

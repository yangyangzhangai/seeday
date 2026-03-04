import { computeAll, parseClassifierResponse } from './report-calculator/core';
import { formatForDiaryAI } from './report-calculator/formatter';
import type { ComputedResult } from './report-calculator/types';

export * from './report-calculator/types';
export * from './report-calculator/core';
export { formatForDiaryAI } from './report-calculator/formatter';

export function processClassifierOutput(
  rawClassifierOutput: string,
  history: ComputedResult[] | null = null,
  lang: 'zh' | 'en' | 'it' = 'zh'
): { computed: ComputedResult; diaryInput: string } {
  const classified = parseClassifierResponse(rawClassifierOutput);
  const computed = computeAll(classified, history);
  const diaryInput = formatForDiaryAI(computed, lang);
  return { computed, diaryInput };
}

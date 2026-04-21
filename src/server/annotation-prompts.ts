// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
export {
  getDefaultAnnotations,
  getModel,
  getSystemPrompt,
} from './annotation-prompts.defaults.js';

export {
  buildSuggestionAwareUserPrompt,
  buildSuggestionUserPrompt,
  buildTodayActivitiesText,
  buildTodayContextText,
  buildUserPrompt,
} from './annotation-prompts.user.js';

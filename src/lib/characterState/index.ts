// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/store/README.md
export { buildCharacterState } from './character-state-builder';
export { detectBehaviors } from './behavior-matcher';
export { createEmptyCharacterStateTracker } from './constants';
export type {
  CharacterStateBuildInput,
  CharacterStateBuildOutput,
  CharacterStateTracker,
} from './constants';

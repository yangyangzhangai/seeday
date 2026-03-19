// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import { describe, expect, it } from 'vitest';
import { buildPlantGenerateUiState } from './plantGenerateUi';

describe('buildPlantGenerateUiState', () => {
  it('locks button in daytime before 20:00', () => {
    const state = buildPlantGenerateUiState({
      hasTodayPlant: false,
      isGenerating: false,
      isTooEarly: true,
    });

    expect(state).toEqual({
      buttonKey: 'plant_generate_button',
      hintKey: 'plant_generate_locked_hint',
      disabled: true,
    });
  });

  it('enables button in evening when plant is not generated', () => {
    const state = buildPlantGenerateUiState({
      hasTodayPlant: false,
      isGenerating: false,
      isTooEarly: false,
    });

    expect(state).toEqual({
      buttonKey: 'plant_generate_button',
      hintKey: 'plant_generate_ready_hint',
      disabled: false,
    });
  });

  it('keeps button locked after plant has been generated', () => {
    const state = buildPlantGenerateUiState({
      hasTodayPlant: true,
      isGenerating: false,
      isTooEarly: false,
    });

    expect(state).toEqual({
      buttonKey: 'plant_generate_done_button',
      hintKey: 'plant_generate_already',
      disabled: true,
    });
  });
});

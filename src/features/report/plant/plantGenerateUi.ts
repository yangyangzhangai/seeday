// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
export interface PlantGenerateUiState {
  buttonKey: string;
  hintKey: string | null;
  disabled: boolean;
}

interface BuildPlantGenerateUiStateInput {
  hasTodayPlant: boolean;
  isGenerating: boolean;
  isTooEarly: boolean;
}

export function buildPlantGenerateUiState(input: BuildPlantGenerateUiStateInput): PlantGenerateUiState {
  if (input.isGenerating) {
    return {
      buttonKey: 'plant_generating',
      hintKey: 'plant_generate_ready_hint',
      disabled: true,
    };
  }

  if (input.hasTodayPlant) {
    return {
      buttonKey: 'plant_generate_done_button',
      hintKey: 'plant_generate_already',
      disabled: true,
    };
  }

  if (input.isTooEarly) {
    return {
      buttonKey: 'plant_generate_button',
      hintKey: null,
      disabled: false,
    };
  }

  return {
    buttonKey: 'plant_generate_button',
    hintKey: 'plant_generate_ready_hint',
    disabled: false,
  };
}

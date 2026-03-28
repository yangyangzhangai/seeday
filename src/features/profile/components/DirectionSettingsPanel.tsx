// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePlantStore } from '../../../store/usePlantStore';
import { DEFAULT_DIRECTION_ORDER } from '../../../types/plant';
import type { PlantCategoryKey } from '../../../types/plant';

interface DirectionSettingsPanelProps {
  onClose: () => void;
}

interface DirectionSlot {
  index: 0 | 1 | 2 | 3 | 4;
  positionKey: string;
}

const SLOTS: DirectionSlot[] = [
  { index: 0, positionKey: 'plant_direction_left_bottom' },
  { index: 1, positionKey: 'plant_direction_left_top' },
  { index: 2, positionKey: 'plant_direction_top' },
  { index: 3, positionKey: 'plant_direction_right_top' },
  { index: 4, positionKey: 'plant_direction_right_bottom' },
];

const CATEGORIES: PlantCategoryKey[] = ['work_study', 'exercise', 'social', 'entertainment', 'life'];

function toCategoryLabelKey(category: PlantCategoryKey): string {
  switch (category) {
    case 'work_study':
      return 'plant_category_work_study';
    case 'exercise':
      return 'plant_category_exercise';
    case 'social':
      return 'category_social';
    case 'entertainment':
      return 'category_entertainment';
    default:
      return 'category_life';
  }
}

export const DirectionSettingsPanel: React.FC<DirectionSettingsPanelProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const directionOrder = usePlantStore(state => state.directionOrder);
  const setDirectionOrder = usePlantStore(state => state.setDirectionOrder);
  const [draft, setDraft] = useState<PlantCategoryKey[]>(() => [...directionOrder]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const stableDraft = useMemo(
    () => (draft.length === 5 ? draft : [...DEFAULT_DIRECTION_ORDER]),
    [draft],
  );

  const duplicateCategories = useMemo(() => {
    const counts = new Map<PlantCategoryKey, number>();
    stableDraft.forEach(category => {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([category]) => category),
    );
  }, [stableDraft]);

  const hasDuplicateSelection = duplicateCategories.size > 0;

  const updateSlot = (slotIndex: 0 | 1 | 2 | 3 | 4, value: PlantCategoryKey) => {
    const next = [...stableDraft];
    next[slotIndex] = value;
    setDraft(next);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (hasDuplicateSelection) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      await setDirectionOrder(stableDraft);
      onClose();
    } catch {
      setSaveError(t('profile_root_direction_save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="border-t border-gray-100 bg-gray-50 px-4 pb-4 pt-3">
      <p className="text-xs text-gray-600">{t('profile_root_direction_settings_desc')}</p>

      <div className="mt-3 space-y-2">
        {SLOTS.map(slot => {
          const isDuplicate = duplicateCategories.has(stableDraft[slot.index]);
          return (
            <label
              key={slot.positionKey}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                isDuplicate ? 'border-red-300 bg-red-50' : 'border-transparent bg-white'
              }`}
            >
              <span className={`text-xs font-medium ${isDuplicate ? 'text-red-600' : 'text-gray-700'}`}>
                {t(slot.positionKey)}
              </span>
            <select
              value={stableDraft[slot.index]}
              onChange={event => updateSlot(slot.index, event.target.value as PlantCategoryKey)}
              className={`min-h-11 rounded-lg border bg-white px-2 text-xs ${
                isDuplicate ? 'border-red-400 text-red-600' : 'border-gray-200 text-gray-700'
              }`}
            >
              {CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {t(toCategoryLabelKey(category))}
                </option>
              ))}
            </select>
            </label>
          );
        })}
      </div>

      {hasDuplicateSelection && (
        <p className="mt-2 text-xs text-red-500">{t('profile_root_direction_duplicate_error')}</p>
      )}
      {saveError && (
        <p className="mt-2 text-xs text-red-500">{saveError}</p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft([...DEFAULT_DIRECTION_ORDER]);
            setSaveError(null);
          }}
          className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700"
        >
          {t('profile_root_direction_reset')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || hasDuplicateSelection}
          className="min-h-11 rounded-lg bg-stone-800 px-3 text-xs font-medium text-white disabled:opacity-60"
        >
          {isSaving ? t('profile_root_direction_saving') : t('profile_root_direction_save')}
        </button>
      </div>
    </div>
  );
};

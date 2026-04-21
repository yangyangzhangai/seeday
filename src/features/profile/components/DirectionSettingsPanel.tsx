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
    <div className="px-4 pb-3 pt-1">
      <p className="text-[10px] font-light text-slate-500">{t('profile_root_direction_settings_desc')}</p>

      <div className="mt-2 space-y-1.5">
        {SLOTS.map(slot => {
          const isDuplicate = duplicateCategories.has(stableDraft[slot.index]);
          return (
            <label
              key={slot.positionKey}
              className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 ${
                isDuplicate ? 'bg-red-50/70' : 'bg-white/55'
              }`}
            >
              <span className={`text-xs ${isDuplicate ? 'text-red-600' : 'text-slate-700'}`}>
                {t(slot.positionKey)}
              </span>
              <select
                value={stableDraft[slot.index]}
                onChange={event => updateSlot(slot.index, event.target.value as PlantCategoryKey)}
                className={`min-h-9 rounded-lg border px-2 text-xs ${
                  isDuplicate
                    ? 'border-red-300 bg-red-50 text-red-600'
                    : 'border-[#CBE7D7] bg-white/80 text-[#355643]'
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
          className="min-h-9 rounded-lg border border-[#CBE7D7] bg-white/75 px-3 text-xs text-[#355643] transition hover:bg-white"
        >
          {t('profile_root_direction_reset')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || hasDuplicateSelection}
          className="min-h-9 rounded-lg border border-transparent px-3 text-xs font-medium text-[#355643] disabled:opacity-60"
          style={{
            background:
              'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)',
            boxShadow: '0 4px 12px rgba(103,154,121,0.15)',
          }}
        >
          {isSaving ? t('profile_root_direction_saving') : t('profile_root_direction_save')}
        </button>
      </div>
    </div>
  );
};

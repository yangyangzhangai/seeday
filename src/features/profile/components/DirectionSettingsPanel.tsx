// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { reportTelemetryEvent } from '../../../services/input/reportTelemetryEvent';
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

function buildDirectionTelemetryPayload(order: PlantCategoryKey[]) {
  return {
    order,
    leftBottom: order[0],
    leftTop: order[1],
    top: order[2],
    rightTop: order[3],
    rightBottom: order[4],
  };
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
    const previous = next[slotIndex];
    next[slotIndex] = value;
    setDraft(next);
    setSaveError(null);
    if (previous !== value) {
      void reportTelemetryEvent('root_direction_changed', {
        slotIndex,
        from: previous,
        to: value,
        order: next,
      });
    }
  };

  const handleSave = async () => {
    if (hasDuplicateSelection) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      await setDirectionOrder(stableDraft);
      void reportTelemetryEvent('root_direction_saved', buildDirectionTelemetryPayload(stableDraft));
      onClose();
    } catch {
      void reportTelemetryEvent('root_direction_save_failed', buildDirectionTelemetryPayload(stableDraft));
      setSaveError(t('profile_root_direction_save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-black/35 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[30px] bg-white shadow-2xl"
        style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 8px)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-bold text-[#1C2E24]">{t('profile_root_direction_settings')}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 transition hover:bg-black/5">
            <X size={18} className="text-[#1C2E24]" />
          </button>
        </div>

        <div className="max-h-[62dvh] overflow-y-auto px-5 pb-3">
          <p className="text-[12px] font-medium text-[#5F7A63]">{t('profile_root_direction_settings_desc')}</p>

          <div className="mt-3 space-y-2">
            {SLOTS.map(slot => {
              const isDuplicate = duplicateCategories.has(stableDraft[slot.index]);
              return (
                <label
                  key={slot.positionKey}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${
                    isDuplicate ? 'bg-red-50/70' : 'bg-[#F7F9F8]'
                  }`}
                >
                  <span className={`text-[13px] font-medium ${isDuplicate ? 'text-red-600' : 'text-[#1C2E24]'}`}>
                    {t(slot.positionKey)}
                  </span>
                  <select
                    value={stableDraft[slot.index]}
                    onChange={event => updateSlot(slot.index, event.target.value as PlantCategoryKey)}
                    className={`min-h-9 rounded-lg border px-2 text-xs ${
                      isDuplicate
                        ? 'border-red-300 bg-red-50 text-red-600'
                        : 'border-[#CBE7D7] bg-white text-[#355643]'
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
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-2">
          <button
            type="button"
            onClick={() => {
              setDraft([...DEFAULT_DIRECTION_ORDER]);
              setSaveError(null);
              void reportTelemetryEvent('root_direction_reset', buildDirectionTelemetryPayload(DEFAULT_DIRECTION_ORDER));
            }}
            className="min-h-10 rounded-xl border border-[#CBE7D7] bg-white px-4 text-xs font-medium text-[#355643] transition hover:bg-[#F7F9F8]"
          >
            {t('profile_root_direction_reset')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || hasDuplicateSelection}
            className="min-h-10 rounded-xl border border-transparent px-4 text-xs font-medium text-[#355643] disabled:opacity-60"
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
    </div>
  );
};

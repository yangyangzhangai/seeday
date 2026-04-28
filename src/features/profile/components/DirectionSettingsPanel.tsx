// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/features/report/README.md
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, X } from 'lucide-react';
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
  const [focusedSlot, setFocusedSlot] = useState<number | null>(null);

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

  useEffect(() => {
    const prev = document.body.style.overflow;
    const scrollContainers = Array.from(document.querySelectorAll<HTMLElement>('.app-scroll-container'));
    const prevScrollStyles = scrollContainers.map((element) => ({
      element,
      overflowY: element.style.overflowY,
      touchAction: element.style.touchAction,
    }));

    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('profile-sheet-open');
    document.body.classList.add('profile-sheet-open');
    scrollContainers.forEach((element) => {
      element.style.overflowY = 'hidden';
      element.style.touchAction = 'none';
    });

    const preventBackgroundTouchMove = (event: TouchEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-root-direction-card="true"]')) return;
      event.preventDefault();
    };
    document.addEventListener('touchmove', preventBackgroundTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prev;
      document.documentElement.classList.remove('profile-sheet-open');
      document.body.classList.remove('profile-sheet-open');
      prevScrollStyles.forEach(({ element, overflowY, touchAction }) => {
        element.style.overflowY = overflowY;
        element.style.touchAction = touchAction;
      });
      document.removeEventListener('touchmove', preventBackgroundTouchMove);
    };
  }, []);

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

  const panel = (
    <div className="app-viewport-fixed z-[9999] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
        onClick={onClose}
      />
      <div
        data-root-direction-card="true"
        className="app-mobile-sheet-card relative flex min-h-0 w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-md sm:rounded-[30px]"
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h3 className="text-base font-bold text-[#1C2E24]">{t('profile_root_direction_settings')}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 transition hover:bg-black/5">
            <X size={18} className="text-[#1C2E24]" />
          </button>
        </div>

        <div className="app-modal-scroll min-h-0 flex-1 px-5 pb-4">
          <p className="text-[12px] font-medium text-[#5F7A63]">{t('profile_root_direction_settings_desc')}</p>

          <div className="mt-4 space-y-2.5">
            {SLOTS.map(slot => {
              const isDuplicate = duplicateCategories.has(stableDraft[slot.index]);
              const selectedCategory = stableDraft[slot.index];
              const isFocused = focusedSlot === slot.index;
              return (
                <label
                  key={slot.positionKey}
                  className={`relative flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 transition active:scale-[0.99] ${
                    isDuplicate ? 'bg-red-50/80' : 'bg-[#F7F9F8] active:bg-[#EEF5F0]'
                  }`}
                >
                  <span className={`text-[13px] font-medium ${isDuplicate ? 'text-red-600' : 'text-[#1C2E24]'}`}>
                    {t(slot.positionKey)}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`inline-flex min-h-9 min-w-[112px] items-center justify-between gap-2 rounded-xl border bg-white px-3 text-xs font-semibold ${
                      isDuplicate
                        ? 'border-red-300 text-red-600'
                        : 'border-[#CBE7D7] text-[#355643]'
                    }`}
                  >
                    <span>{t(toCategoryLabelKey(selectedCategory))}</span>
                    <ChevronDown
                      size={16}
                      strokeWidth={2.3}
                      className={`shrink-0 transition-transform ${isFocused ? 'rotate-180' : ''}`}
                    />
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={event => updateSlot(slot.index, event.target.value as PlantCategoryKey)}
                    onFocus={() => setFocusedSlot(slot.index)}
                    onBlur={() => setFocusedSlot(null)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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

        <div
          className="flex shrink-0 items-center gap-2 border-t border-black/5 bg-white px-5 pt-3"
          style={{ paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 10px))' }}
        >
          <button
            type="button"
            onClick={() => {
              setDraft([...DEFAULT_DIRECTION_ORDER]);
              setSaveError(null);
              void reportTelemetryEvent('root_direction_reset', buildDirectionTelemetryPayload(DEFAULT_DIRECTION_ORDER));
            }}
            className="min-h-11 flex-1 rounded-2xl border border-[#CBE7D7] bg-white px-4 text-sm font-semibold text-[#355643] transition hover:bg-[#F7F9F8]"
          >
            {t('profile_root_direction_reset')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || hasDuplicateSelection}
            className="min-h-11 flex-1 rounded-2xl border border-transparent px-4 text-sm font-semibold text-[#355643] disabled:opacity-60"
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

  return createPortal(panel, document.body);
};

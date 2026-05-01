// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> docs/Seeday_植物生长_技术实现文档_v1.7.docx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../api/supabase';
import { callPlantGenerateAPI } from '../api/client';
import i18n from '../i18n';
import { buildRootSegments } from '../lib/rootRenderer';
import { mapSourcesToPlantActivities } from '../lib/plantActivityMapper';
import { fromDbPlantRecord } from '../lib/dbMappers';
import { getSupabaseSession } from '../lib/supabase-utils';
import { useChatStore } from './useChatStore';
import { PERSIST_KEYS, LEGACY_PERSIST_KEYS } from './persistKeys';
import { readLegacyPersistedState } from './persistMigrationHelpers';
import { useOutboxStore } from './useOutboxStore';
import { createScopedJSONStorage } from './scopedPersistStorage';
import type {
  DailyPlantRecord,
  PlantCategoryKey,
  PlantGenerateResponse,
  RootSegment,
} from '../types/plant';
import { DEFAULT_DIRECTION_ORDER } from '../types/plant';
import { reportTelemetryEvent } from '../services/input/reportTelemetryEvent';

interface PlantState {
  todaySegments: RootSegment[];
  todayPlant: DailyPlantRecord | null;
  directionOrder: PlantCategoryKey[];
  isGenerating: boolean;
  selectedRootId: string | null;
  lastAutoBackfillAttemptDate: string | null;
  loadTodayData: () => Promise<void>;
  refreshTodaySegments: () => void;
  startActivitySync: () => void;
  stopActivitySync: () => void;
  generatePlant: () => Promise<PlantGenerateResponse>;
  setSelectedRootId: (id: string | null) => void;
  setDirectionOrder: (order: PlantCategoryKey[]) => Promise<void>;
}

let chatSubscription: (() => void) | null = null;

function resolvePlantLang(): 'zh' | 'en' | 'it' {
  const lang = i18n.language?.toLowerCase() ?? 'en';
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('it')) return 'it';
  return 'en';
}

export function addDaysToDate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shouldAttemptPlantAutoBackfill(lastAttemptDate: string | null, todayDate: string): boolean {
  return lastAttemptDate !== todayDate;
}

export function resolvePlantDurationForMessage(
  duration: number | undefined,
  timestamp: number,
  nowMs: number,
): number {
  if (duration !== undefined) {
    return Math.max(0, duration);
  }
  const elapsedMinutes = Math.max(0, Math.round((nowMs - timestamp) / (1000 * 60)));
  return elapsedMinutes >= 15 ? elapsedMinutes : 0;
}

function areSegmentsEqual(prev: RootSegment[], next: RootSegment[]): boolean {
  if (prev.length !== next.length) return false;
  for (let index = 0; index < prev.length; index += 1) {
    const left = prev[index];
    const right = next[index];
    if (
      left.id !== right.id
      || left.direction !== right.direction
      || left.activityId !== right.activityId
      || left.minutes !== right.minutes
      || left.focus !== right.focus
      || left.isMainRoot !== right.isMainRoot
      || left.branchOrder !== right.branchOrder
      || left.growthMode !== right.growthMode
      || left.branchRatio !== right.branchRatio
      || left.parentRootId !== right.parentRootId
    ) {
      return false;
    }
  }
  return true;
}

function getTodayDateAndRange(): { date: string; timezone: string; dayStartMs: number; dayEndMs: number } {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const date = `${year}-${month}-${day}`;

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  return {
    date,
    timezone,
    dayStartMs: dayStart.getTime(),
    dayEndMs: dayEnd.getTime(),
  };
}

function normalizeDirectionOrder(order: PlantCategoryKey[]): PlantCategoryKey[] {
  const unique: PlantCategoryKey[] = [];
  for (const category of order) {
    if (!DEFAULT_DIRECTION_ORDER.includes(category)) continue;
    if (!unique.includes(category)) {
      unique.push(category);
    }
  }
  for (const fallback of DEFAULT_DIRECTION_ORDER) {
    if (!unique.includes(fallback)) {
      unique.push(fallback);
    }
  }
  return unique.slice(0, 5);
}

function isDefaultDirectionOrder(order: PlantCategoryKey[]): boolean {
  const normalized = normalizeDirectionOrder(order);
  return normalized.every((category, index) => category === DEFAULT_DIRECTION_ORDER[index]);
}

function resolveDirectionOrderPreference(
  localOrder: PlantCategoryKey[] | null | undefined,
  cloudOrder: PlantCategoryKey[] | null,
): PlantCategoryKey[] {
  const normalizedLocal = localOrder?.length ? normalizeDirectionOrder(localOrder) : [...DEFAULT_DIRECTION_ORDER];
  if (!cloudOrder) {
    return normalizedLocal;
  }

  const normalizedCloud = normalizeDirectionOrder(cloudOrder);
  if (isDefaultDirectionOrder(normalizedCloud) && !isDefaultDirectionOrder(normalizedLocal)) {
    return normalizedLocal;
  }

  return normalizedCloud;
}

function toDirectionMap(order: PlantCategoryKey[]): Record<PlantCategoryKey, 0 | 1 | 2 | 3 | 4> {
  const fullOrder = normalizeDirectionOrder(order);
  const directionMap: Record<PlantCategoryKey, 0 | 1 | 2 | 3 | 4> = {
    entertainment: 0,
    social: 1,
    work_study: 2,
    exercise: 3,
    life: 4,
  };
  fullOrder.forEach((category, index) => {
    directionMap[category] = index as 0 | 1 | 2 | 3 | 4;
  });
  return directionMap;
}

async function syncDirectionOrderToCloud(userId: string, order: PlantCategoryKey[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('plant_direction_config')
    .delete()
    .eq('user_id', userId);
  if (deleteError) throw deleteError;

  const payload = order.map((categoryKey, index) => ({
    user_id: userId,
    direction_index: index,
    category_key: categoryKey,
  }));

  const { error: insertError } = await supabase
    .from('plant_direction_config')
    .insert(payload);
  if (insertError) throw insertError;
}

function isTodayPlantLocked(todayPlant: DailyPlantRecord | null): boolean {
  if (!todayPlant) return false;
  const { date } = getTodayDateAndRange();
  return todayPlant.date === date;
}

export const usePlantStore = create<PlantState>()(
  persist(
    (set, get) => ({
      todaySegments: [],
      todayPlant: null,
      directionOrder: [...DEFAULT_DIRECTION_ORDER],
      isGenerating: false,
      selectedRootId: null,
      lastAutoBackfillAttemptDate: null,

      loadTodayData: async () => {
        const session = await getSupabaseSession();
        if (!session) {
          set({ todayPlant: null, todaySegments: [], lastAutoBackfillAttemptDate: null });
          return;
        }

        const { date, timezone } = getTodayDateAndRange();
        const [plantRes, directionRes] = await Promise.all([
          supabase
            .from('daily_plant_records')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('date', date)
            .maybeSingle(),
          supabase
            .from('plant_direction_config')
            .select('direction_index, category_key')
            .eq('user_id', session.user.id)
            .order('direction_index', { ascending: true }),
        ]);

        const localDirectionOrder = get().directionOrder;
        let cloudDirectionOrder: PlantCategoryKey[] | null = null;
        if (directionRes.data?.length === 5) {
          const next = [...DEFAULT_DIRECTION_ORDER];
          directionRes.data.forEach((item) => {
            const index = Number(item.direction_index);
            if (index >= 0 && index < 5) {
              next[index] = item.category_key as PlantCategoryKey;
            }
          });
          cloudDirectionOrder = next;
        }
        set({ directionOrder: resolveDirectionOrderPreference(localDirectionOrder, cloudDirectionOrder) });

        if (plantRes.data) {
          set({ todayPlant: fromDbPlantRecord(plantRes.data) });
        } else {
          set({ todayPlant: null });
        }

        get().refreshTodaySegments();

        const { lastAutoBackfillAttemptDate } = get();
        if (!shouldAttemptPlantAutoBackfill(lastAutoBackfillAttemptDate, date)) {
          return;
        }
        set({ lastAutoBackfillAttemptDate: date });

        const previousDate = addDaysToDate(date, -1);
        const { data: previousPlant, error: previousPlantError } = await supabase
          .from('daily_plant_records')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('date', previousDate)
          .maybeSingle();

        if (previousPlantError || previousPlant) {
          return;
        }

        try {
          void reportTelemetryEvent('plant_generate_requested', {
            date: previousDate,
            source: 'auto_backfill',
            timezone,
          });
          await callPlantGenerateAPI({
            date: previousDate,
            timezone,
            lang: resolvePlantLang(),
          });
          void reportTelemetryEvent('plant_generate_succeeded', {
            date: previousDate,
            source: 'auto_backfill',
          });
        } catch (error) {
          void reportTelemetryEvent('plant_generate_failed', {
            date: previousDate,
            source: 'auto_backfill',
            reason: error instanceof Error ? error.message : 'unknown_error',
          });
          if (import.meta.env.DEV) {
            console.warn('[plant] auto-backfill failed', error);
          }
        }
      },

      refreshTodaySegments: () => {
        const { todayPlant, directionOrder } = get();
        if (isTodayPlantLocked(todayPlant)) {
          return;
        }

        const { dayStartMs, dayEndMs, date } = getTodayDateAndRange();
        const nowMs = Date.now();
        const messages = useChatStore.getState().messages
          .filter(message => (
            message.mode === 'record'
            && !message.isMood
            && message.timestamp >= dayStartMs
            && message.timestamp < dayEndMs
          ))
          .map((message) => {
            return {
              ...message,
              duration: resolvePlantDurationForMessage(message.duration, message.timestamp, nowMs),
            };
          });

        const activities = mapSourcesToPlantActivities(messages);
        const directionMap = toDirectionMap(directionOrder);
        const seedKey = `plant-${date}`;

        const segments = buildRootSegments(
          activities.map(activity => ({
            activityId: activity.id,
            direction: directionMap[activity.categoryKey],
            minutes: activity.minutes,
            focus: activity.focus,
          })),
          seedKey,
        );

        if (!areSegmentsEqual(get().todaySegments, segments)) {
          set({ todaySegments: segments });
        }
      },

      startActivitySync: () => {
        if (chatSubscription) {
          return;
        }

        chatSubscription = useChatStore.subscribe((state, prevState) => {
          if (state.messages === prevState.messages) {
            return;
          }
          get().refreshTodaySegments();
        });
      },

      stopActivitySync: () => {
        if (chatSubscription) {
          chatSubscription();
          chatSubscription = null;
        }
      },

      generatePlant: async () => {
        const session = await getSupabaseSession();
        if (!session) {
          throw new Error('No active session');
        }

        const payload = getTodayDateAndRange();
        set({ isGenerating: true });
        try {
          void reportTelemetryEvent('plant_generate_requested', {
            date: payload.date,
            source: 'manual',
            timezone: payload.timezone,
          });
          const response = await callPlantGenerateAPI({
            ...payload,
            lang: resolvePlantLang(),
          });
          if (response.status === 'generated' || response.status === 'already_generated') {
            set({ todayPlant: response.plant, selectedRootId: null });
          }
          void reportTelemetryEvent('plant_generate_succeeded', {
            date: payload.date,
            source: 'manual',
            status: response.status,
          });
          return response;
        } catch (error) {
          void reportTelemetryEvent('plant_generate_failed', {
            date: payload.date,
            source: 'manual',
            reason: error instanceof Error ? error.message : 'unknown_error',
          });
          throw error;
        } finally {
          set({ isGenerating: false });
        }
      },

      setSelectedRootId: (id) => set({ selectedRootId: id }),

      setDirectionOrder: async (order) => {
        const nextOrder = normalizeDirectionOrder(order);
        set({ directionOrder: nextOrder });
        get().refreshTodaySegments();
        try {
          const session = await getSupabaseSession();
          if (!session) return;
          await syncDirectionOrderToCloud(session.user.id, nextOrder);
        } catch (error) {
          useOutboxStore.getState().enqueue({
            kind: 'plant.directionOrder',
            payload: { order: nextOrder },
          });
          if (import.meta.env.DEV) {
            console.warn('[plant] sync directionOrder failed, queued for retry:', error);
          }
        }
      },
    }),
    {
      name: PERSIST_KEYS.plant,
      storage: createScopedJSONStorage<Partial<PlantState>>('plant'),
      skipHydration: true,
      partialize: (state) => ({
        todayPlant: state.todayPlant,
        directionOrder: state.directionOrder,
        lastAutoBackfillAttemptDate: state.lastAutoBackfillAttemptDate,
      }),
      merge: (persistedState, currentState) => ({
        ...(currentState as PlantState),
        ...(readLegacyPersistedState<PlantState>(LEGACY_PERSIST_KEYS.plant) || {}),
        ...((persistedState as Partial<PlantState>) || {}),
      }),
    },
  ),
);

// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyPlantRecord } from '../types/plant';

const { getSupabaseSession, callPlantHistoryAPI } = vi.hoisted(() => ({
  getSupabaseSession: vi.fn(),
  callPlantHistoryAPI: vi.fn(),
}));

vi.mock('../lib/supabase-utils', () => ({
  getSupabaseSession,
}));

vi.mock('../api/client', () => ({
  callPlantGenerateAPI: vi.fn(),
  callPlantHistoryAPI,
}));

import { resolveCachedPlantForDate, usePlantStore } from './usePlantStore';

function plant(date: string, plantId: string, userId = 'user-a'): DailyPlantRecord {
  return {
    id: `${date}-${plantId}`,
    userId,
    date,
    timezone: 'Europe/Paris',
    rootMetrics: {
      dominantRatio: 1,
      top2Gap: 1,
      depthScore: 1,
      evenness: 1,
      branchiness: 1,
      totalMinutes: 60,
      activeTargetDirections: 1,
      directionBreakdown: {},
    },
    plantId,
    rootType: 'sha',
    plantStage: 'early',
    isSpecial: false,
    isSupportVariant: false,
    diaryText: '',
    generatedAt: Date.now(),
  };
}

describe('usePlantStore history cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlantStore.setState({
      todayPlant: null,
      historyUserId: null,
      historyPlantsByDate: {},
      loadedHistoryRanges: {},
    });
  });

  it('replaces cached dates when the active cache user changes', () => {
    usePlantStore.getState().cachePlantRecord(plant('2026-07-23', 'lavender'), 'user-a');
    usePlantStore.getState().cachePlantRecord(plant('2026-07-24', 'fern', 'user-b'), 'user-b');

    expect(usePlantStore.getState().historyUserId).toBe('user-b');
    expect(usePlantStore.getState().historyPlantsByDate['2026-07-23']).toBeUndefined();
    expect(usePlantStore.getState().historyPlantsByDate['2026-07-24']?.plantId).toBe('fern');
  });

  it('deduplicates a loaded monthly range and reuses its records', async () => {
    getSupabaseSession.mockResolvedValue({ user: { id: 'user-a' } });
    callPlantHistoryAPI.mockResolvedValue({
      success: true,
      records: [plant('2026-07-23', 'lavender')],
    });

    const first = await usePlantStore.getState().loadPlantHistory('2026-07-01', '2026-07-31');
    const second = await usePlantStore.getState().loadPlantHistory('2026-07-01', '2026-07-31');

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(callPlantHistoryAPI).toHaveBeenCalledTimes(1);
  });

  it('never treats yesterday plant as the current-day plant', () => {
    const staleTodayPlant = plant('2026-07-23', 'lavender');
    const state = {
      historyUserId: 'user-a',
      historyPlantsByDate: {},
      todayPlant: staleTodayPlant,
    };

    expect(resolveCachedPlantForDate(state, 'user-a', '2026-07-24', '2026-07-24')).toBeNull();
  });
});

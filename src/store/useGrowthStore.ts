import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';

export type BottleType = 'habit' | 'goal';
export type BottleStatus = 'active' | 'achieved' | 'irrigated';
export type BottleSyncState = 'synced' | 'pending' | 'failed';

export const MAX_BOTTLES = 10;

export interface Bottle {
  id: string;
  name: string;
  type: BottleType;
  stars: number;       // 0–21
  round: number;       // current round (goal bottles track multiple rounds)
  status: BottleStatus;
  createdAt: number;
  syncState?: BottleSyncState;
  syncError?: string | null;
}

interface GrowthState {
  bottles: Bottle[];
  dailyGoal: string;
  goalDate: string;            // ISO date string (YYYY-MM-DD) of last goal entry
  popupDisabled: boolean;      // user chose "don't show again"
  isLoading: boolean;
  hasHydrated: boolean;
  lastSyncError: string | null;
  addBottle: (name: string, type: BottleType) => Bottle | null;
  removeBottle: (id: string) => void;
  incrementBottleStar: (id: string) => void;
  incrementBottleStars: (id: string, amount: number) => void;
  markBottleAchieved: (id: string) => void;
  markBottleIrrigated: (id: string) => void;
  continueBottle: (id: string) => void;
  setDailyGoal: (goal: string) => void;
  shouldShowDailyGoal: () => boolean;
  disablePopup: () => void;
  enablePopup: () => void;
  /** Fetch bottles from Supabase and hydrate local state */
  fetchBottles: () => Promise<void>;
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDbBottle(bottle: Bottle, userId: string) {
  return {
    id: bottle.id,
    user_id: userId,
    name: bottle.name,
    type: bottle.type,
    stars: bottle.stars,
    round: bottle.round,
    status: bottle.status,
    created_at: new Date(bottle.createdAt).toISOString(),
  };
}

function fromDbBottle(row: Record<string, unknown>): Bottle {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as BottleType,
    stars: row.stars as number,
    round: row.round as number,
    status: row.status as BottleStatus,
    createdAt: new Date(row.created_at as string).getTime(),
    syncState: 'synced',
    syncError: null,
  };
}

function withDefaultSyncState(bottle: Bottle): Bottle {
  return {
    ...bottle,
    syncState: bottle.syncState ?? 'synced',
    syncError: bottle.syncError ?? null,
  };
}

export const useGrowthStore = create<GrowthState>()(
  persist(
    (set, get) => ({
      bottles: [],
      dailyGoal: '',
      goalDate: '',
      popupDisabled: false,
      isLoading: false,
      hasHydrated: false,
      lastSyncError: null,

      addBottle: (name, type) => {
        const activeBottles = get().bottles.filter((b) => b.status === 'active');
        if (activeBottles.length >= MAX_BOTTLES) return null;
        const duplicate = activeBottles.some(
          (b) => b.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (duplicate) return null;

        const bottle: Bottle = {
          id: uuidv4(),
          name,
          type,
          stars: 0,
          round: 1,
          status: 'active',
          createdAt: Date.now(),
          syncState: 'pending',
          syncError: null,
        };
        set((s) => ({ bottles: [...s.bottles, bottle] }));

        void (async () => {
          try {
            const session = await getSupabaseSession();
            if (!session) return;
            const { error } = await supabase.from('bottles').insert([toDbBottle(bottle, session.user.id)]);
            if (error) throw error;
            set((s) => ({
              bottles: s.bottles.map((b) =>
                b.id === bottle.id
                  ? { ...b, syncState: 'synced', syncError: null }
                  : b
              ),
            }));
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[GrowthStore] insert bottle failed', err);
            set((s) => ({
              bottles: s.bottles.map((b) =>
                b.id === bottle.id
                  ? {
                    ...b,
                    syncState: 'failed',
                    syncError: err instanceof Error ? err.message : 'growth_sync_failed',
                  }
                  : b
              ),
              lastSyncError: err instanceof Error ? err.message : 'growth_sync_failed',
            }));
          }
        })();

        return bottle;
      },

      removeBottle: (id) => {
        set((s) => ({ bottles: s.bottles.filter((b) => b.id !== id) }));

        void (async () => {
          try {
            const session = await getSupabaseSession();
            if (!session) return;
            await supabase.from('bottles').delete().eq('id', id).eq('user_id', session.user.id);
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[GrowthStore] delete bottle failed', err);
          }
        })();
      },

      incrementBottleStar: (id) => {
        get().incrementBottleStars(id, 1);
      },

      incrementBottleStars: (id, amount) => {
        const starsToAdd = Math.max(1, Math.floor(amount || 1));
        set((s) => ({
          bottles: s.bottles.map((b) => {
            if (b.id !== id || b.status !== 'active') return b;
            const newStars = b.stars + starsToAdd;
            if (newStars >= 21) {
              return { ...b, stars: 21, status: 'achieved' as BottleStatus };
            }
            return { ...b, stars: newStars };
          }),
        }));

        void (async () => {
          try {
            const session = await getSupabaseSession();
            if (!session) return;
            const updated = get().bottles.find(b => b.id === id);
            if (!updated) return;
            await supabase
              .from('bottles')
              .update({ stars: updated.stars, status: updated.status, updated_at: new Date().toISOString() })
              .eq('id', id)
              .eq('user_id', session.user.id);
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[GrowthStore] update stars failed', err);
          }
        })();
      },

      markBottleAchieved: (id) => {
        set((s) => ({
          bottles: s.bottles.map((b) =>
            b.id === id ? { ...b, status: 'achieved' as BottleStatus } : b
          ),
        }));

        void (async () => {
          try {
            const session = await getSupabaseSession();
            if (!session) return;
            await supabase
              .from('bottles')
              .update({ status: 'achieved', updated_at: new Date().toISOString() })
              .eq('id', id)
              .eq('user_id', session.user.id);
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[GrowthStore] markAchieved failed', err);
          }
        })();
      },

      // 浇灌后归档移除瓶子（本地删除，云端标记为 irrigated 保留历史）
      markBottleIrrigated: (id) => {
        set((s) => ({ bottles: s.bottles.filter((b) => b.id !== id) }));

        void (async () => {
          try {
            const session = await getSupabaseSession();
            if (!session) return;
            await supabase
              .from('bottles')
              .update({ status: 'irrigated', updated_at: new Date().toISOString() })
              .eq('id', id)
              .eq('user_id', session.user.id);
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[GrowthStore] markIrrigated failed', err);
          }
        })();
      },

      // 继续追踪：重置星星，进入下一轮
      continueBottle: (id) => {
        set((s) => ({
          bottles: s.bottles.map((b) =>
            b.id === id
              ? { ...b, status: 'active' as BottleStatus, stars: 0, round: b.round + 1 }
              : b
          ),
        }));

        void (async () => {
          try {
            const session = await getSupabaseSession();
            if (!session) return;
            const updated = get().bottles.find(b => b.id === id);
            if (!updated) return;
            await supabase
              .from('bottles')
              .update({ status: 'active', stars: 0, round: updated.round, updated_at: new Date().toISOString() })
              .eq('id', id)
              .eq('user_id', session.user.id);
          } catch (err) {
            if (import.meta.env.DEV) console.warn('[GrowthStore] continueBottle failed', err);
          }
        })();
      },

      setDailyGoal: (goal) => set({ dailyGoal: goal, goalDate: todayDateStr() }),

      shouldShowDailyGoal: () => {
        const { goalDate, popupDisabled } = get();
        if (popupDisabled) return false;
        return goalDate !== todayDateStr();
      },

      disablePopup: () => set({ popupDisabled: true }),
      enablePopup: () => set({ popupDisabled: false }),

      fetchBottles: async () => {
        set({ isLoading: true, lastSyncError: null });
        try {
          const session = await getSupabaseSession();
          if (!session) {
            set({ isLoading: false, hasHydrated: true });
            return;
          }
          const { data, error } = await supabase
            .from('bottles')
            .select('*')
            .eq('user_id', session.user.id)
            .neq('status', 'irrigated')   // irrigated = archived, don't restore
            .order('created_at', { ascending: true });
          if (error) {
            set({
              isLoading: false,
              hasHydrated: true,
              lastSyncError: error.message,
            });
            return;
          }

          const cloudBottles = (data as Record<string, unknown>[]).map(fromDbBottle);
          const cloudIds = new Set(cloudBottles.map((b) => b.id));
          const localBottles = get().bottles.map(withDefaultSyncState);
          const localOnly = localBottles.filter((b) => !cloudIds.has(b.id));

          let reconciledLocalOnly = localOnly;
          let reconcileError: string | null = null;

          if (localOnly.length > 0) {
            const { error: reconcileWriteError } = await supabase
              .from('bottles')
              .upsert(localOnly.map((b) => toDbBottle(b, session.user.id)), { onConflict: 'id' });

            if (reconcileWriteError) {
              reconcileError = reconcileWriteError.message;
              reconciledLocalOnly = localOnly.map((b) => ({
                ...b,
                syncState: 'failed',
                syncError: reconcileWriteError.message,
              }));
            } else {
              reconciledLocalOnly = localOnly.map((b) => ({
                ...b,
                syncState: 'synced',
                syncError: null,
              }));
            }
          }

          set(() => ({
            bottles: [...cloudBottles, ...reconciledLocalOnly],
            isLoading: false,
            hasHydrated: true,
            lastSyncError: reconcileError,
          }));
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[GrowthStore] fetchBottles failed', err);
          set({
            isLoading: false,
            hasHydrated: true,
            lastSyncError: err instanceof Error ? err.message : 'growth_sync_failed',
          });
        }
      },
    }),
    {
      name: 'growth-store',
      partialize: (state) => ({
        bottles: state.bottles,
        dailyGoal: state.dailyGoal,
        goalDate: state.goalDate,
        popupDisabled: state.popupDisabled,
      }),
    }
  )
);

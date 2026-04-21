import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';
import { withDbRetry } from '../lib/dbRetry';
import { playSound } from '../services/sound/soundService';

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
  checkinDates?: string[];
  syncState?: BottleSyncState;
  syncError?: string | null;
}

function normalizeCheckinDates(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];

  const normalized = raw
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

  return Array.from(new Set(normalized)).sort();
}

function isMissingCheckinDatesColumnError(err: unknown): boolean {
  // Supabase returns plain PostgrestError objects (not instanceof Error), so check .message directly
  const message = (typeof err === 'object' && err !== null)
    ? String((err as Record<string, unknown>).message ?? '')
    : String(err ?? '');
  const lower = message.toLowerCase();
  return lower.includes('bottle_checkin_dates') && (lower.includes('column') || lower.includes('schema'));
}

function removeCheckinDatesField(payload: Record<string, unknown>): Record<string, unknown> {
  const { bottle_checkin_dates: _ignored, ...rest } = payload;
  return rest;
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
  decrementBottleStars: (id: string, amount: number, options?: { removeTodayCheckin?: boolean }) => void;
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
    bottle_checkin_dates: normalizeCheckinDates(bottle.checkinDates),
    created_at: new Date(bottle.createdAt).toISOString(),
    deleted_at: null,                        // 明确标记为未删除
    updated_at: new Date().toISOString(),
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
    checkinDates: normalizeCheckinDates(row.bottle_checkin_dates),
    syncState: 'synced',
    syncError: null,
  };
}

function withDefaultSyncState(bottle: Bottle): Bottle {
  return {
    ...bottle,
    // 旧数据没有 syncState 时，默认 'pending' 而非 'synced'
    // 原因：无法确认旧数据是否成功推过云端，宁可多推一次（upsert 幂等），
    // 也不能误判为"云端已删"导致本地数据丢失
    syncState: bottle.syncState ?? 'pending',
    syncError: bottle.syncError ?? null,
    checkinDates: normalizeCheckinDates(bottle.checkinDates),
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
          checkinDates: [],
          syncState: 'pending',
          syncError: null,
        };
        set((s) => ({ bottles: [...s.bottles, bottle] }));

        void withDbRetry('GrowthStore:addBottle', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const payload = toDbBottle(bottle, session.user.id);
          const { error } = await supabase.from('bottles').insert([payload]);
          if (error) {
            if (!isMissingCheckinDatesColumnError(error)) throw error;
            const fallback = await supabase.from('bottles').insert([removeCheckinDatesField(payload)]);
            if (fallback.error) throw fallback.error;
          }
          set((s) => ({
            bottles: s.bottles.map((b) =>
              b.id === bottle.id ? { ...b, syncState: 'synced', syncError: null } : b
            ),
          }));
        }).catch((err: unknown) => {
          set((s) => ({
            bottles: s.bottles.map((b) =>
              b.id === bottle.id
                ? { ...b, syncState: 'failed', syncError: err instanceof Error ? err.message : 'growth_sync_failed' }
                : b
            ),
            lastSyncError: err instanceof Error ? err.message : 'growth_sync_failed',
          }));
        });

        return bottle;
      },

      removeBottle: (id) => {
        set((s) => ({ bottles: s.bottles.filter((b) => b.id !== id) }));

        void withDbRetry('GrowthStore:removeBottle', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const { error } = await supabase
            .from('bottles')
            .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', session.user.id);
          if (error) throw new Error(error.message);
        });
      },

      incrementBottleStar: (id) => {
        get().incrementBottleStars(id, 1);
      },

      incrementBottleStars: (id, amount) => {
        const starsToAdd = Math.max(1, Math.floor(amount || 1));
        playSound('ding');
        let willAchieve = false;
        let didIncrement = false;
        set((s) => ({
          bottles: s.bottles.map((b) => {
            if (b.id !== id || b.status !== 'active') return b;
            didIncrement = true;
            const newStars = b.stars + starsToAdd;
            const today = todayDateStr();
            const checkinDates = normalizeCheckinDates([...(b.checkinDates ?? []), today]);
            if (newStars >= 21) {
              willAchieve = true;
              return { ...b, stars: 21, status: 'achieved' as BottleStatus, checkinDates };
            }
            return { ...b, stars: newStars, checkinDates };
          }),
        }));
        if (didIncrement && typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('growth-star-earned', {
              detail: { bottleId: id, starsAdded: starsToAdd },
            }),
          );
        }
        if (willAchieve) setTimeout(() => playSound('ding'), 400);

        void withDbRetry('GrowthStore:incrementStars', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const updated = get().bottles.find(b => b.id === id);
          if (!updated) return;
          const payload = {
            stars: updated.stars,
            status: updated.status,
            bottle_checkin_dates: normalizeCheckinDates(updated.checkinDates),
            updated_at: new Date().toISOString(),
          };
          const { error } = await supabase.from('bottles').update(payload).eq('id', id).eq('user_id', session.user.id);
          if (error) {
            if (!isMissingCheckinDatesColumnError(error)) throw error;
            const fallback = await supabase.from('bottles').update(removeCheckinDatesField(payload)).eq('id', id).eq('user_id', session.user.id);
            if (fallback.error) throw fallback.error;
          }
        });
      },

      decrementBottleStars: (id, amount, options) => {
        const starsToRemove = Math.max(1, Math.floor(amount || 1));
        const today = todayDateStr();
        const removeTodayCheckin = options?.removeTodayCheckin === true;

        set((s) => ({
          bottles: s.bottles.map((b) => {
            if (b.id !== id || b.status === 'irrigated') return b;
            const nextStars = Math.max(0, b.stars - starsToRemove);
            const nextStatus: BottleStatus = nextStars >= 21 ? 'achieved' : 'active';
            const nextCheckinDates = removeTodayCheckin
              ? normalizeCheckinDates((b.checkinDates ?? []).filter((date) => date !== today))
              : normalizeCheckinDates(b.checkinDates);
            return {
              ...b,
              stars: nextStars,
              status: nextStatus,
              checkinDates: nextCheckinDates,
            };
          }),
        }));

        void withDbRetry('GrowthStore:decrementStars', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const updated = get().bottles.find((b) => b.id === id);
          if (!updated) return;
          const payload = {
            stars: updated.stars,
            status: updated.status,
            bottle_checkin_dates: normalizeCheckinDates(updated.checkinDates),
            updated_at: new Date().toISOString(),
          };
          const { error } = await supabase.from('bottles').update(payload).eq('id', id).eq('user_id', session.user.id);
          if (error) {
            if (!isMissingCheckinDatesColumnError(error)) throw error;
            const fallback = await supabase.from('bottles').update(removeCheckinDatesField(payload)).eq('id', id).eq('user_id', session.user.id);
            if (fallback.error) throw fallback.error;
          }
        });
      },

      markBottleAchieved: (id) => {
        set((s) => ({
          bottles: s.bottles.map((b) =>
            b.id === id ? { ...b, status: 'achieved' as BottleStatus } : b
          ),
        }));

        void withDbRetry('GrowthStore:markAchieved', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const { error } = await supabase
            .from('bottles')
            .update({ status: 'achieved', updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', session.user.id);
          if (error) throw new Error(error.message);
        });
      },

      // 浇灌后归档移除瓶子（本地删除，云端标记为 irrigated 保留历史）
      markBottleIrrigated: (id) => {
        set((s) => ({ bottles: s.bottles.filter((b) => b.id !== id) }));

        void withDbRetry('GrowthStore:markIrrigated', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const { error } = await supabase
            .from('bottles')
            .update({ status: 'irrigated', updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', session.user.id);
          if (error) throw new Error(error.message);
        });
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

        void withDbRetry('GrowthStore:continueBottle', async () => {
          const session = await getSupabaseSession();
          if (!session) return;
          const updated = get().bottles.find(b => b.id === id);
          if (!updated) return;
          const { error } = await supabase
            .from('bottles')
            .update({ status: 'active', stars: 0, round: updated.round, updated_at: new Date().toISOString() })
            .eq('id', id).eq('user_id', session.user.id);
          if (error) throw new Error(error.message);
        });
      },

      setDailyGoal: (goal) => set({ dailyGoal: goal, goalDate: todayDateStr() }),

      shouldShowDailyGoal: () => {
        const { goalDate, popupDisabled } = get();
        if (popupDisabled) return false;
        return goalDate !== todayDateStr();
      },

      disablePopup: () => set({ popupDisabled: true }),
      enablePopup: () => set({ popupDisabled: false }),

      // 策略：推 pending/failed → 收集仍然失败的 → 拉云端（软删除+irrigated过滤）→ 合并失败的
      // syncState='synced' 但云端没有的瓶子 = 已在其他设备删除，本地也移除（防复活）
      fetchBottles: async () => {
        set({ isLoading: true, lastSyncError: null });
        try {
          const session = await getSupabaseSession();
          if (!session) {
            set({ isLoading: false, hasHydrated: true });
            return;
          }

          // ① 找出本地所有未同步的瓶子
          const localBottles = get().bottles.map(withDefaultSyncState);
          const needsPush = localBottles.filter(
            (b) => b.syncState === 'pending' || b.syncState === 'failed'
          );

          // ② 尝试推送，收集仍然失败的
          const stillFailed: Bottle[] = [];
          await Promise.all(
            needsPush.map(async (b) => {
              try {
                const payload = toDbBottle(b, session.user.id);
                const { error } = await supabase
                  .from('bottles')
                  .upsert([payload], { onConflict: 'id' });
                if (error) {
                  if (!isMissingCheckinDatesColumnError(error)) throw error;
                  const fallback = await supabase
                    .from('bottles')
                    .upsert([removeCheckinDatesField(payload)], { onConflict: 'id' });
                  if (fallback.error) throw fallback.error;
                }
              } catch {
                stillFailed.push(b);
              }
            })
          );

          // ③ 拉云端（过滤软删除 + irrigated 归档）
          const { data, error } = await supabase
            .from('bottles')
            .select('*')
            .eq('user_id', session.user.id)
            .is('deleted_at', null)
            .neq('status', 'irrigated')
            .order('created_at', { ascending: true });

          if (error) {
            set({ isLoading: false, hasHydrated: true, lastSyncError: error.message });
            return;
          }

          const cloudBottles = (data as Record<string, unknown>[]).map(fromDbBottle);
          const cloudIds = new Set(cloudBottles.map((b) => b.id));

          // ④ 合并：云端数据 + 仍然失败的本地瓶子（云端没有的才保留）
          const survivingFailed = stillFailed
            .filter((b) => !cloudIds.has(b.id))
            .map((b) => ({ ...b, syncState: 'failed' as BottleSyncState, syncError: 'sync_failed' }));

          set({
            bottles: [...cloudBottles, ...survivingFailed],
            isLoading: false,
            hasHydrated: true,
            lastSyncError: stillFailed.length > 0
              ? `${stillFailed.length} 个瓶子同步失败，将在下次重试`
              : null,
          });
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

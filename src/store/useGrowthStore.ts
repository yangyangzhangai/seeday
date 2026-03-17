import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type BottleType = 'habit' | 'goal';
export type BottleStatus = 'active' | 'achieved' | 'irrigated';

export const MAX_BOTTLES = 10;

export interface Bottle {
  id: string;
  name: string;
  type: BottleType;
  stars: number;       // 0–21
  round: number;       // current round (goal bottles track multiple rounds)
  status: BottleStatus;
  createdAt: number;
}

interface GrowthState {
  bottles: Bottle[];
  dailyGoal: string;
  goalDate: string;            // ISO date string (YYYY-MM-DD) of last goal entry
  popupDisabled: boolean;      // user chose "don't show again"
  addBottle: (name: string, type: BottleType) => Bottle | null;
  removeBottle: (id: string) => void;
  incrementBottleStar: (id: string) => void;
  markBottleAchieved: (id: string) => void;
  markBottleIrrigated: (id: string) => void;
  continueBottle: (id: string) => void;
  setDailyGoal: (goal: string) => void;
  shouldShowDailyGoal: () => boolean;
  disablePopup: () => void;
  enablePopup: () => void;
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useGrowthStore = create<GrowthState>()(
  persist(
    (set, get) => ({
      bottles: [],
      dailyGoal: '',
      goalDate: '',
      popupDisabled: false,

      addBottle: (name, type) => {
        const activeBottles = get().bottles.filter((b) => b.status === 'active');
        if (activeBottles.length >= MAX_BOTTLES) return null;

        const bottle: Bottle = {
          id: uuidv4(),
          name,
          type,
          stars: 0,
          round: 1,
          status: 'active',
          createdAt: Date.now(),
        };
        set((s) => ({ bottles: [...s.bottles, bottle] }));
        return bottle;
      },

      removeBottle: (id) => {
        set((s) => ({ bottles: s.bottles.filter((b) => b.id !== id) }));
      },

      incrementBottleStar: (id) => {
        set((s) => ({
          bottles: s.bottles.map((b) => {
            if (b.id !== id || b.status !== 'active') return b;
            const newStars = b.stars + 1;
            if (newStars >= 21) {
              return { ...b, stars: 21, status: 'achieved' as BottleStatus };
            }
            return { ...b, stars: newStars };
          }),
        }));
      },

      markBottleAchieved: (id) => {
        set((s) => ({
          bottles: s.bottles.map((b) =>
            b.id === id ? { ...b, status: 'achieved' as BottleStatus } : b
          ),
        }));
      },

      // 浇灌后归档移除瓶子
      markBottleIrrigated: (id) => {
        set((s) => ({
          bottles: s.bottles.filter((b) => b.id !== id),
        }));
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
      },

      setDailyGoal: (goal) => set({ dailyGoal: goal, goalDate: todayDateStr() }),

      shouldShowDailyGoal: () => {
        const { goalDate, popupDisabled } = get();
        if (popupDisabled) return false;
        return goalDate !== todayDateStr();
      },

      disablePopup: () => set({ popupDisabled: true }),

      enablePopup: () => set({ popupDisabled: false }),
    }),
    { name: 'growth-store' }
  )
);

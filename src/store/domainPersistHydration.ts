// DOC-DEPS: LLM.md -> docs/CURRENT_TASK.md -> src/store/README.md
import { useAnnotationStore } from './useAnnotationStore';
import { useChatStore } from './useChatStore';
import { useFocusStore } from './useFocusStore';
import { useGrowthStore } from './useGrowthStore';
import { useMoodStore } from './useMoodStore';
import { useOutboxStore } from './useOutboxStore';
import { usePlantStore } from './usePlantStore';
import { useReminderStore } from './useReminderStore';
import { useReportStore } from './useReportStore';
import { useStardustStore } from './useStardustStore';
import { useTimingStore } from './useTimingStore';
import { useTodoStore } from './useTodoStore';

type PersistableStore = {
  persist?: {
    rehydrate?: () => Promise<void> | void;
  };
};

function rehydrateStore(store: PersistableStore): Promise<void> {
  const rehydrate = store.persist?.rehydrate;
  if (!rehydrate) return Promise.resolve();
  return Promise.resolve(rehydrate());
}

export async function rehydrateAllDomainPersistStores(): Promise<void> {
  await Promise.allSettled([
    rehydrateStore(useChatStore as unknown as PersistableStore),
    rehydrateStore(useTodoStore as unknown as PersistableStore),
    rehydrateStore(useGrowthStore as unknown as PersistableStore),
    rehydrateStore(useMoodStore as unknown as PersistableStore),
    rehydrateStore(useReportStore as unknown as PersistableStore),
    rehydrateStore(useAnnotationStore as unknown as PersistableStore),
    rehydrateStore(useFocusStore as unknown as PersistableStore),
    rehydrateStore(usePlantStore as unknown as PersistableStore),
    rehydrateStore(useTimingStore as unknown as PersistableStore),
    rehydrateStore(useStardustStore as unknown as PersistableStore),
    rehydrateStore(useReminderStore as unknown as PersistableStore),
    rehydrateStore(useOutboxStore as unknown as PersistableStore),
  ]);
}

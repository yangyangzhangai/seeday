// DOC-DEPS: LLM.md -> src/store/README.md
import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useTodoStore } from '../store/useTodoStore';
import { useGrowthStore } from '../store/useGrowthStore';
import { useStardustStore } from '../store/useStardustStore';
import { useAuthStore } from '../store/useAuthStore';
import { useOutboxStore } from '../store/useOutboxStore';

/**
 * When the device comes back online after being offline, flush all pending
 * local writes and pull the latest cloud state for key stores.
 */
export function useNetworkSync(): void {
  useEffect(() => {
    function handleOnline() {
      const user = useAuthStore.getState().user;
      if (!user) return;

      void useOutboxStore.getState().flush(user.id).catch(() => {});

      // Push pending todos and re-pull cloud state
      void useTodoStore.getState().fetchTodos().catch(() => {});
      void useGrowthStore.getState().fetchBottles().catch(() => {});
      void useChatStore.getState().fetchMessages().catch(() => {});
      void useStardustStore
        .getState()
        .syncPendingStardusts()
        .then(() => useStardustStore.getState().fetchStardusts())
        .catch(() => {});
    }

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
}

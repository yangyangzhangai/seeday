// DOC-DEPS: LLM.md -> src/store/README.md
import { useEffect } from 'react';
import { supabase } from '../api/supabase';
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

    async function handleForeground() {
      if (document.visibilityState !== 'visible') return;
      const user = useAuthStore.getState().user;
      if (!user) return;
      // Refresh the session to pick up user_metadata changes made on other devices.
      // TOKEN_REFRESHED fires onAuthStateChange which re-applies preferences.
      try { await supabase.auth.refreshSession(); } catch { }
    }

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleForeground);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleForeground);
    };
  }, []);
}

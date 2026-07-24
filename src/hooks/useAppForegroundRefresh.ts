// DOC-DEPS: LLM.md -> src/store/README.md
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import { useMoodStore } from '../store/useMoodStore';
import { useReportStore } from '../store/useReportStore';
import { useOutboxStore } from '../store/useOutboxStore';
import { useReminderStore } from '../store/useReminderStore';
import { logSupabaseAuthDebug, refreshSupabaseSession } from '../lib/supabase-utils';

/**
 * iOS/Android only: when the app returns to foreground, re-fetch core data
 * to cover the gap where Supabase Realtime WebSocket was suspended by the OS.
 */
export function useAppForegroundRefresh() {
  const userId = useAuthStore(s => s.user?.id);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !userId) return;

    let handle: Awaited<ReturnType<typeof App.addListener>> | null = null;

    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      void (async () => {
        try {
          await refreshSupabaseSession('useAppForegroundRefresh:appStateChange');
        } catch (error) {
          logSupabaseAuthDebug('useAppForegroundRefresh:appStateChange:refresh:unexpected', error);
        }
        void useOutboxStore.getState().flush(userId)
          .then(() => useReminderStore.getState().syncCloudResponses(userId))
          .catch(() => {});
        void useChatStore.getState().fetchMessages();
        void useMoodStore.getState().fetchMoods();
        void useReportStore.getState().fetchReports();
      })();
    }).then(l => { handle = l; });

    return () => {
      handle?.remove();
    };
  }, [userId]);
}

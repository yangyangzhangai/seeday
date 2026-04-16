// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/*/README.md
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { AIAnnotationBubble } from './components/feedback/AIAnnotationBubble';
import { ChatPage } from './features/chat/ChatPage';
import { ReportPage } from './features/report/ReportPage';
import { GrowthPage } from './features/growth/GrowthPage';
import { AuthPage } from './features/auth/AuthPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { UpgradePage } from './features/profile/UpgradePage';
import { LiveInputTelemetryPage } from './features/telemetry/LiveInputTelemetryPage';
import { TelemetryHubPage } from './features/telemetry/TelemetryHubPage';
import { AiAnnotationTelemetryPage } from './features/telemetry/AiAnnotationTelemetryPage';
import { TodoDecomposeTelemetryPage } from './features/telemetry/TodoDecomposeTelemetryPage';
import { UserAnalyticsDashboardPage } from './features/telemetry/UserAnalyticsDashboardPage';
import { isTelemetryAdmin } from './features/telemetry/isTelemetryAdmin';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { useReportStore } from './store/useReportStore';
import { useAnnotationStore } from './store/useAnnotationStore';
import { StardustAnimation } from './components/feedback/StardustAnimation';
import { useStardustStore } from './store/useStardustStore';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useNightReminder } from './hooks/useNightReminder';
import { useMidnightAutoGenerate } from './hooks/useMidnightAutoGenerate';
import { useTranslation } from 'react-i18next';
import { cn } from './lib/utils';
import {
  APP_MODAL_OVERLAY_CLASS,
  APP_MODAL_CARD_CLASS,
  APP_MODAL_PRIMARY_BUTTON_CLASS,
  APP_MODAL_SECONDARY_BUTTON_CLASS,
} from './lib/modalTheme';

const BlankScreen: React.FC = () => (
  <div className="fixed inset-0 bg-gray-50" />
);

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const location = useLocation();

  if (loading) return <BlankScreen />;
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return children;
};

const AuthRoute: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);

  if (loading) return <BlankScreen />;
  if (user) return <Navigate to="/chat" replace />;

  return <AuthPage />;
};

const RequireTelemetryAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);

  if (loading) return <BlankScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isTelemetryAdmin(user)) return <Navigate to="/profile" replace />;
  return children;
};

/** Thin wrapper around Outlet that fades in on route change */
const PageOutlet: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <main
      key={pathname}
      className="relative flex-1 overflow-hidden pb-24 animate-[pageIn_0.18s_ease-out] md:pb-8"
    >
      <Outlet />
    </main>
  );
};

const MainLayout = () => {
  const messages = useChatStore(state => state.messages);
  const currentAnnotation = useAnnotationStore(state => state.currentAnnotation);
  const user = useAuthStore(state => state.user);
  const aiModeEnabled = useAuthStore(state => state.preferences.aiModeEnabled);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showReminder, dismiss } = useNightReminder();
  useMidnightAutoGenerate();
  const [animationState, setAnimationState] = React.useState<{
    isActive: boolean;
    sourceRect: DOMRect | null;
    targetRect: DOMRect | null;
    emojiChar: string;
  }>({
    isActive: false,
    sourceRect: null,
    targetRect: null,
    emojiChar: '✨',
  });

  // 获取时间线中最后一个可见的记录消息（避免附着在活动下的心情消息被错误作为凝结目标）
  const lastRecordMessage = React.useMemo(() => {
    return messages
      .filter(m => m.mode === 'record' && (!m.isMood || m.detached === true))
      .slice(-1)[0];
  }, [messages]);

  const relatedMessage = React.useMemo(() => {
    const annotationMessageId = currentAnnotation?.relatedEvent?.data?.messageId;
    if (typeof annotationMessageId === 'string') {
      const exact = messages.find((message) => message.id === annotationMessageId);
      if (exact) {
        return exact;
      }
    }
    return lastRecordMessage;
  }, [currentAnnotation?.id, currentAnnotation?.relatedEvent?.data?.messageId, messages, lastRecordMessage]);

  const condenseTargetMessage = React.useMemo(() => {
    if (!relatedMessage) return lastRecordMessage;
    if (!relatedMessage.isMood || relatedMessage.detached === true) {
      return relatedMessage;
    }

    const parentEvent = messages.find(
      (message) => !message.isMood && message.moodDescriptions?.some((desc) => desc.id === relatedMessage.id),
    );
    return parentEvent || lastRecordMessage || relatedMessage;
  }, [relatedMessage, lastRecordMessage, messages]);

  // 处理凝结动画
  const handleCondense = React.useCallback((emojiChar?: string) => {
    // 获取气泡位置（作为动画起点）
    const bubbleElement = document.querySelector('[data-stardust-bubble]');
    const targetElement = condenseTargetMessage
      ? document.querySelector(`[data-message-id="${condenseTargetMessage.id}"]`)
      : null;

    if (bubbleElement && targetElement) {
      setAnimationState({
        isActive: true,
        sourceRect: bubbleElement.getBoundingClientRect(),
        targetRect: targetElement.getBoundingClientRect(),
        emojiChar: emojiChar || '✨', // 使用批注中提取的emoji，如果没有则默认星星
      });
    }
  }, [condenseTargetMessage]);

  // 动画完成回调
  const handleAnimationComplete = React.useCallback(() => {
    setAnimationState(prev => ({ ...prev, isActive: false }));
    // 触发一次messages的读取来刷新UI显示新创建的Emoji
    if (condenseTargetMessage) {
      // 强制ChatPage重新渲染以显示Emoji
      window.dispatchEvent(new CustomEvent('stardust-created', {
        detail: { messageId: condenseTargetMessage.id }
      }));
    }
  }, [condenseTargetMessage]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let running = false;

    const dayKey = (value: Date) => (
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    );

    const startOfLocalDay = (value: Date) => (
      new Date(value.getFullYear(), value.getMonth(), value.getDate())
    );

    const ensureDailyBackfill = async () => {
      if (running || cancelled) return;
      running = true;
      try {
        const now = new Date();
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const yesterdayKey = dayKey(yesterday);
        const createdAtSource = user?.created_at ? new Date(user.created_at) : null;
        const createdAtDay = createdAtSource && !Number.isNaN(createdAtSource.getTime())
          ? startOfLocalDay(createdAtSource)
          : null;
        const backfillStart = createdAtDay && createdAtDay.getTime() <= yesterday.getTime()
          ? createdAtDay
          : yesterday;
        const reportState = useReportStore.getState();
        const dailyReports = reportState.reports.filter((report) => report.type === 'daily');

        const reportDates = dailyReports
          .map((report) => startOfLocalDay(new Date(report.date)))
          .filter((date) => dayKey(date) <= yesterdayKey);
        const existingKeys = new Set(reportDates.map(dayKey));
        let cursor = new Date(backfillStart);
        while (!cancelled && dayKey(cursor) <= yesterdayKey) {
          const key = dayKey(cursor);
          if (!existingKeys.has(key)) {
            await reportState.generateReport('daily', cursor.getTime());
            existingKeys.add(key);
          }
          cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        }
      } finally {
        running = false;
      }
    };

    // Catch up when app cold-starts: auto-fill all missing daily diaries up to yesterday.
    void ensureDailyBackfill();

    const intervalId = setInterval(() => {
      void ensureDailyBackfill();
    }, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void ensureDailyBackfill();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#FCFAF7] md:bg-[radial-gradient(circle_at_18%_20%,#ffffff_0%,#f4f1eb_45%,#efe9de_100%)]">
      <PageOutlet />
      <BottomNav />
      {/* AI 批注气泡 - 全局显示 */}
      {aiModeEnabled ? (
        <AIAnnotationBubble
          relatedMessage={relatedMessage}
          onCondense={handleCondense}
        />
      ) : null}
      {/* 星尘凝结动画 */}
      <StardustAnimation
        isActive={animationState.isActive}
        sourceRect={animationState.sourceRect}
        targetRect={animationState.targetRect}
        emojiChar={animationState.emojiChar}
        onComplete={handleAnimationComplete}
      />
      {/* 晚间生成提醒 */}
      {showReminder && (
        <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-6', APP_MODAL_OVERLAY_CLASS)} onClick={dismiss}>
          <div className={cn(APP_MODAL_CARD_CLASS, 'w-full max-w-xs rounded-3xl p-6 text-center animate-in fade-in zoom-in-95')} onClick={e => e.stopPropagation()}>
            <p className="text-base font-semibold text-slate-800 mb-2">{t('night_reminder_title')}</p>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">{t('night_reminder_body')}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={dismiss}
                className={cn(APP_MODAL_SECONDARY_BUTTON_CLASS, 'px-4 py-2 text-sm rounded-full active:opacity-70')}
              >
                {t('night_reminder_dismiss')}
              </button>
              <button
                onClick={() => { dismiss(); navigate('/report'); }}
                className={cn(APP_MODAL_PRIMARY_BUTTON_CLASS, 'px-4 py-2 text-sm rounded-full active:opacity-70')}
              >
                {t('night_reminder_go')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const initializeAuth = useAuthStore(state => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Multi-device realtime sync: subscribes when signed in, unsubscribes on sign-out
  useRealtimeSync();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={(
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          )}
        >
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="todo" element={<Navigate to="/growth" replace />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="growth" element={<GrowthPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="upgrade" element={<UpgradePage />} />
          <Route path="telemetry" element={<RequireTelemetryAdmin><TelemetryHubPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/live-input" element={<RequireTelemetryAdmin><LiveInputTelemetryPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/ai-annotation" element={<RequireTelemetryAdmin><AiAnnotationTelemetryPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/todo-decompose" element={<RequireTelemetryAdmin><TodoDecomposeTelemetryPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/user-analytics" element={<RequireTelemetryAdmin><UserAnalyticsDashboardPage /></RequireTelemetryAdmin>} />
        </Route>
        <Route path="/auth" element={<AuthRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/*/README.md
import React, { useEffect } from 'react';
import { isSameDay } from 'date-fns';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { AIAnnotationBubble } from './components/feedback/AIAnnotationBubble';
import { ChatPage } from './features/chat/ChatPage';
import { ReportPage } from './features/report/ReportPage';
import { GrowthPage } from './features/growth/GrowthPage';
import { AuthPage } from './features/auth/AuthPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { LiveInputTelemetryPage } from './features/telemetry/LiveInputTelemetryPage';
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
    const ensurePreviousDayReport = () => {
      const previousDay = new Date();
      previousDay.setDate(previousDay.getDate() - 1);
      const reportState = useReportStore.getState();
      const hasPreviousDayReport = reportState.reports.some(
        (report) => report.type === 'daily' && isSameDay(new Date(report.date), previousDay),
      );
      if (!hasPreviousDayReport) {
        reportState.generateReport('daily', previousDay.getTime());
      }
    };

    // Catch up when app cold-starts (if user wasn't active exactly at midnight).
    ensurePreviousDayReport();

    const intervalId = setInterval(ensurePreviousDayReport, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ensurePreviousDayReport();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
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
          <Route path="telemetry/live-input" element={<LiveInputTelemetryPage />} />
        </Route>
        <Route path="/auth" element={<AuthRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

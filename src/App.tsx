// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/*/README.md
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { Header } from './components/layout/Header';
import { AIAnnotationBubble } from './components/feedback/AIAnnotationBubble';
import { ChatPage } from './features/chat/ChatPage';
import { ReportPage } from './features/report/ReportPage';
import { GrowthPage } from './features/growth/GrowthPage';
import { AuthPage } from './features/auth/AuthPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { useReportStore } from './store/useReportStore';
import { StardustAnimation } from './components/feedback/StardustAnimation';
import { useStardustStore } from './store/useStardustStore';
import { useRealtimeSync } from './hooks/useRealtimeSync';

/** Thin wrapper around Outlet that fades in on route change */
const PageOutlet: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <main
      key={pathname}
      className="flex-1 overflow-hidden pt-14 pb-16 relative animate-[pageIn_0.18s_ease-out]"
    >
      <Outlet />
    </main>
  );
};

const MainLayout = () => {
  const messages = useChatStore(state => state.messages);
  const user = useAuthStore(state => state.user);
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

  // 获取最后一个记录模式的消息（活动或心情，作为凝结目标）
  const lastRecordMessage = React.useMemo(() => {
    return messages
      .filter(m => m.mode === 'record')
      .slice(-1)[0];
  }, [messages]);

  // 处理凝结动画
  const handleCondense = React.useCallback((emojiChar?: string) => {
    // 获取气泡位置（作为动画起点）
    const bubbleElement = document.querySelector('[data-stardust-bubble]');
    const targetElement = lastRecordMessage
      ? document.querySelector(`[data-message-id="${lastRecordMessage.id}"]`)
      : null;

    if (bubbleElement && targetElement) {
      setAnimationState({
        isActive: true,
        sourceRect: bubbleElement.getBoundingClientRect(),
        targetRect: targetElement.getBoundingClientRect(),
        emojiChar: emojiChar || '✨', // 使用批注中提取的emoji，如果没有则默认星星
      });
    }
  }, [lastRecordMessage]);

  // 动画完成回调
  const handleAnimationComplete = React.useCallback(() => {
    setAnimationState(prev => ({ ...prev, isActive: false }));
    // 触发一次messages的读取来刷新UI显示新创建的Emoji
    if (lastRecordMessage) {
      // 强制ChatPage重新渲染以显示Emoji
      window.dispatchEvent(new CustomEvent('stardust-created', {
        detail: { messageId: lastRecordMessage.id }
      }));
    }
  }, [lastRecordMessage]);

  useEffect(() => {
    if (!user?.id) return;

    const reportStore = useReportStore.getState();
    let lastDay = new Date().toDateString();

    const generatePreviousDayReport = () => {
      const nowStr = new Date().toDateString();
      if (nowStr !== lastDay) {
        const previousDay = new Date();
        previousDay.setDate(previousDay.getDate() - 1);
        reportStore.generateReport('daily', previousDay.getTime());
        lastDay = nowStr;
      }
    };

    const intervalId = setInterval(generatePreviousDayReport, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        generatePreviousDayReport();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden">
      <Header />
      <PageOutlet />
      <BottomNav />
      {/* AI 批注气泡 - 全局显示 */}
      <AIAnnotationBubble
        relatedMessage={lastRecordMessage}
        onCondense={handleCondense}
      />
      {/* 星尘凝结动画 */}
      <StardustAnimation
        isActive={animationState.isActive}
        sourceRect={animationState.sourceRect}
        targetRect={animationState.targetRect}
        emojiChar={animationState.emojiChar}
        onComplete={handleAnimationComplete}
      />
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
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="todo" element={<Navigate to="/growth" replace />} />
          <Route path="report" element={<ReportPage />} />
          <Route path="growth" element={<GrowthPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

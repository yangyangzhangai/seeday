// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/*/README.md
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BottomNav } from './components/layout/BottomNav';
import { AIAnnotationBubble } from './components/feedback/AIAnnotationBubble';
import { ChatPage } from './features/chat/ChatPage';
import { ReportPage } from './features/report/ReportPage';
import { GrowthPage } from './features/growth/GrowthPage';
import { OnboardingFlow } from './features/onboarding/OnboardingFlow';
import { AuthPage } from './features/auth/AuthPage';
import { getPendingProfileWrite } from './store/authProfileHelpers';
import { ProfilePage } from './features/profile/ProfilePage';
import { RoutineSettingsPanel } from './features/profile/components/RoutineSettingsPanel';
import { UserProfilePanel } from './features/profile/components/UserProfilePanel';
import { UpgradePage } from './features/profile/UpgradePage';
import { LiveInputTelemetryPage } from './features/telemetry/LiveInputTelemetryPage';
import { TelemetryHubPage } from './features/telemetry/TelemetryHubPage';
import { AiAnnotationTelemetryPage } from './features/telemetry/AiAnnotationTelemetryPage';
import { TodoDecomposeTelemetryPage } from './features/telemetry/TodoDecomposeTelemetryPage';
import { UserAnalyticsDashboardPage } from './features/telemetry/UserAnalyticsDashboardPage';
import { ProfileSettingsTelemetryPage } from './features/telemetry/ProfileSettingsTelemetryPage';
import { FeedbackTelemetryPage } from './features/telemetry/FeedbackTelemetryPage';
import { isTelemetryAdmin } from './features/telemetry/isTelemetryAdmin';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { useReportStore } from './store/useReportStore';
import { useAnnotationStore } from './store/useAnnotationStore';
import { StardustAnimation } from './components/feedback/StardustAnimation';
import { StarAnimationOverlay } from './components/feedback/StarAnimationOverlay';
import { useStardustStore } from './store/useStardustStore';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { useAppForegroundRefresh } from './hooks/useAppForegroundRefresh';
import { useReminderSystem } from './hooks/useReminderSystem';
import { useMidnightAutoGenerate } from './hooks/useMidnightAutoGenerate';
import { useNetworkSync } from './hooks/useNetworkSync';
import { ReminderPopup, EveningCheckPopup } from './components/ReminderPopup';
import { useReminderStore } from './store/useReminderStore';
import { getReminderCopy } from './services/reminder/reminderCopy';
import { QuickActivityPicker } from './components/QuickActivityPicker';
import { CloudRetryButton } from './components/feedback/CloudRetryButton';
import { useOutboxStore, getOutboxRetryableCount } from './store/useOutboxStore';

const BlankScreen: React.FC = () => (
  <div className="fixed inset-0 bg-gray-50" />
);

/** 账号创建不足 72 小时且尚无 profile → 视为新用户需要 onboarding */
function isNewUserAccount(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs < 72 * 60 * 60 * 1000;
}

function isTruthyEnv(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const userProfileV2 = useAuthStore(state => state.userProfileV2);

  // DEV preview bypass: localStorage.setItem('dev_preview','1') 跳过登录校验
  if (import.meta.env.DEV && localStorage.getItem('dev_preview') === '1') {
    return children;
  }

  if (loading) return <BlankScreen />;
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  // 仅在账号 < 72h 且无 profile（含本地兜底）时才强制走 onboarding
  const hasPendingProfile = Boolean(getPendingProfileWrite(user.id));
  if (userProfileV2 === null && !hasPendingProfile && isNewUserAccount(user.created_at)) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
};

/** 新版引导流：仅已登录新账号可进入；已完成 onboarding 或老账号直接进首页 */
const OnboardingRoute: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const userProfileV2 = useAuthStore(state => state.userProfileV2);
  const location = useLocation();

  if (loading) return <BlankScreen />;

  // DEV/Test override: allow preview onboarding even for "old accounts"
  // - URL: /onboarding?forceOnboarding=1
  // - Env: VITE_FORCE_ONBOARDING=1 (build-time)
  const forceOnboardingByQuery = new URLSearchParams(location.search).get('forceOnboarding') === '1';
  const forceOnboardingByEnv = isTruthyEnv(import.meta.env.VITE_FORCE_ONBOARDING);
  if (forceOnboardingByQuery || forceOnboardingByEnv) {
    return <OnboardingFlow />;
  }

  // 已登录且已完成 onboarding（有 profile 或老账号）→ 进首页
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const hasPendingProfile = Boolean(getPendingProfileWrite(user.id));
  if (userProfileV2 !== null || hasPendingProfile || !isNewUserAccount(user.created_at)) {
    return <Navigate to="/chat" replace />;
  }

  return <OnboardingFlow />;
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
  const disablePageInAnimation = pathname === '/upgrade';
  const hideBottomChrome = pathname === '/profile/routine' || pathname === '/profile/memory';
  return (
    <main
      key={pathname}
      className={`relative flex-1 overflow-hidden md:pb-8 ${
        disablePageInAnimation ? '' : 'animate-[pageIn_0.18s_ease-out]'
      }`}
      style={{
        paddingBottom: hideBottomChrome
          ? '0px'
          : 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
      }}
    >
      <Outlet />
    </main>
  );
};

const MainLayout = () => {
  const location = useLocation();
  const messages = useChatStore(state => state.messages);
  const currentAnnotation = useAnnotationStore(state => state.currentAnnotation);
  const user = useAuthStore(state => state.user);
  const outboxRetryCount = useOutboxStore((state) => getOutboxRetryableCount(state.entries));
  const retryOutboxNow = useOutboxStore((state) => state.retryNow);
  const aiModeEnabled = useAuthStore(state => state.preferences.aiModeEnabled);
  const navigate = useNavigate();
  const { confirmReminderFromPopup } = useReminderSystem(navigate);
  useMidnightAutoGenerate();
  useNetworkSync();
  const activePopupType = useReminderStore((s) => s.activePopupType);
  const markConfirmed = useReminderStore((s) => s.markConfirmed);
  const showPickerForDeny = useReminderStore((s) => s.showPickerForDeny);
  const aiMode = useAuthStore((s) => s.preferences.aiMode);
  const userName = (useAuthStore((s) => s.userProfileV2?.manual?.freeText) as string | undefined) ?? undefined;
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

  const shouldShowOutboxRetry = Boolean(user?.id) && outboxRetryCount > 0 && location.pathname !== '/growth';

  const handleOutboxRetry = React.useCallback(() => {
    if (!user?.id) return;
    void retryOutboxNow(user.id);
  }, [retryOutboxNow, user?.id]);

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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white md:bg-white">
      <PageOutlet />
      {location.pathname === '/profile/routine' || location.pathname === '/profile/memory' ? null : <BottomNav />}
      {shouldShowOutboxRetry ? (
        <div className="pointer-events-none fixed right-4 z-40" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 44px)' }}>
          <CloudRetryButton
            onClick={handleOutboxRetry}
            className="pointer-events-auto"
          />
        </div>
      ) : null}
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
      <StarAnimationOverlay />
      {/* 主动提醒弹窗 */}
      {activePopupType && activePopupType !== 'evening_check' && activePopupType !== 'weekend_evening_check' && (
        <ReminderPopup
          type={activePopupType}
          copyText={getReminderCopy(aiMode, activePopupType, { name: userName })}
          onConfirm={() => { void confirmReminderFromPopup(activePopupType); }}
          onDeny={() => showPickerForDeny()}
        />
      )}
      {(activePopupType === 'evening_check' || activePopupType === 'weekend_evening_check') && (
        <EveningCheckPopup
          copyText={getReminderCopy(aiMode, activePopupType, { name: userName })}
          todayEventCount={messages.filter((m) => m.mode === 'record').length}
          onViewReport={() => { markConfirmed(activePopupType); navigate('/report?action=generate-diary'); }}
          onGrowPlant={() => { markConfirmed(activePopupType); navigate('/report?action=generate-plant'); }}
          onSnooze={() => { markConfirmed(activePopupType); }}
          onClose={() => { markConfirmed(activePopupType); }}
        />
      )}
      <QuickActivityPicker />
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
  // iOS/Android: re-fetch core data when app returns from background
  useAppForegroundRefresh();

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
          <Route path="profile/routine" element={<RoutineSettingsPanel page />} />
          <Route path="profile/memory" element={<UserProfilePanel page />} />
          <Route path="upgrade" element={<UpgradePage />} />
          <Route path="telemetry" element={<RequireTelemetryAdmin><TelemetryHubPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/live-input" element={<RequireTelemetryAdmin><LiveInputTelemetryPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/ai-annotation" element={<RequireTelemetryAdmin><AiAnnotationTelemetryPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/todo-decompose" element={<RequireTelemetryAdmin><TodoDecomposeTelemetryPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/user-analytics" element={<RequireTelemetryAdmin><UserAnalyticsDashboardPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/profile-settings" element={<RequireTelemetryAdmin><ProfileSettingsTelemetryPage /></RequireTelemetryAdmin>} />
          <Route path="telemetry/feedback" element={<RequireTelemetryAdmin><FeedbackTelemetryPage /></RequireTelemetryAdmin>} />
        </Route>
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

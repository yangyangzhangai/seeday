// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md

export interface UserAnalyticsDailySeries {
  day: string; // YYYY-MM-DD
  newUsers: number;
  dau: number;
  newPremium: number;
  activePremium: number;
}

export interface UserAnalyticsRetentionRow {
  cohortWeek: string; // YYYY-WNN
  cohortSize: number;
  d7Retained: number;
  d7RetentionRate: number; // 0-1
}

export interface UserAnalyticsOverview {
  totalUsers: number;
  totalPremium: number;
  conversionRate: number; // 0-1
  activeToday: number;
  activePremiumToday: number;
  newToday: number;
  newPremiumToday: number;
}

export interface UserAnalyticsDashboardResponse {
  overview: UserAnalyticsOverview;
  dailySeries: UserAnalyticsDailySeries[];
  retention: UserAnalyticsRetentionRow[];
  generatedAt: string;
}

export interface UserAnalyticsLookupResult {
  id: string;
  email: string;
  createdAt: string;
  isPremium: boolean;
  membershipPlan: string | null;
  totalMessages: number;
  totalFocusSessions: number;
  loginStreak: number | null;
  lastMessageAt: string | null;
}

export interface UserAnalyticsLookupResponse {
  found: boolean;
  user: UserAnalyticsLookupResult | null;
}

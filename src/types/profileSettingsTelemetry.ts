// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/api/README.md

export interface ProfileSettingsTelemetryBreakdownItem {
  key: string;
  count: number;
  percent: number;
}

export interface ProfileSettingsTelemetrySeriesPoint {
  day: string;
  openedCount: number;
  changedCount: number;
  resetCount: number;
  savedCount: number;
  saveFailedCount: number;
  uniqueUsers: number;
}

export interface ProfileSettingsTelemetryRecentEvent {
  id: string;
  createdAt: string;
  userId: string;
  eventName: string;
  slotIndex: number | null;
  from: string | null;
  to: string | null;
  order: string[];
}

export interface ProfileSettingsTelemetrySummary {
  days: number;
  openedCount: number;
  changedCount: number;
  resetCount: number;
  savedCount: number;
  saveFailedCount: number;
  uniqueUsers: number;
  usersWhoSaved: number;
  saveSuccessRate: number;
  avgChangesPerSave: number;
}

export interface ProfileSettingsTelemetryDashboardResponse {
  success: boolean;
  summary: ProfileSettingsTelemetrySummary;
  series: ProfileSettingsTelemetrySeriesPoint[];
  eventNames: ProfileSettingsTelemetryBreakdownItem[];
  changedSlots: ProfileSettingsTelemetryBreakdownItem[];
  savedOrders: ProfileSettingsTelemetryBreakdownItem[];
  recentEvents: ProfileSettingsTelemetryRecentEvent[];
}

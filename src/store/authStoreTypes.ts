// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/auth/README.md
import type { AiCompanionMode } from '../lib/aiCompanion';
import type { UserProfileV2 } from '../types/userProfile';
import type { SupportedUiLanguage } from './authLanguageHelpers';

export type AnnotationDropRate = 'low' | 'medium' | 'high';
export type UiLanguage = SupportedUiLanguage;
export type MembershipPlan = 'free' | 'plus';
export type MembershipSource = 'metadata' | 'trial' | 'temporary_unlock' | 'default_free';

export interface UserPreferences {
  aiMode: AiCompanionMode;
  aiModeEnabled: boolean;
  dailyGoalEnabled: boolean;
  annotationDropRate: AnnotationDropRate;
}

export interface MembershipState {
  plan: MembershipPlan;
  isPlus: boolean;
  source: MembershipSource;
}

export interface LocationMetadataInput {
  countryCode: string;
  latitude: number;
  longitude: number;
  locationLabel?: string;
  source?: 'manual_geocode' | 'device_gps';
}

export interface AuthState {
  user: any | null;
  loading: boolean;
  preferences: UserPreferences;
  longTermProfileEnabled: boolean;
  userProfileV2: UserProfileV2 | null;
  membershipPlan: MembershipPlan;
  membershipSource: MembershipSource;
  isPlus: boolean;
  activityStreak: number | null;
  initialize: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  signUp: (email: string, pass: string, nickname?: string, avatarDataUrl?: string) => Promise<{ error: any }>;
  verifySignUpCode: (email: string, code: string) => Promise<{ error: any }>;
  resendSignUpCode: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateAvatar: (avatarDataUrl: string) => Promise<{ error: any }>;
  updateDisplayName: (displayName: string) => Promise<{ error: any }>;
  updateLocationMetadata: (input: LocationMetadataInput) => Promise<{ error: any }>;
  updateLongTermProfileEnabled: (enabled: boolean) => Promise<{ error: any }>;
  updateUserProfile: (
    updater: Partial<UserProfileV2> | ((prev: UserProfileV2 | null) => UserProfileV2),
  ) => Promise<{ error: any }>;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
  updateLanguagePreference: (language: string) => Promise<{ error: any }>;
  refreshActivityStreak: () => Promise<void>;
}

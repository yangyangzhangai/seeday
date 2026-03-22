import { callLiveInputTelemetryIngestAPI } from '../../api/client';
import type { LiveInputClassification } from './types';
import {
  collectClassificationReasons,
  type LiveInputTelemetryCorrectionKind,
  type LiveInputTelemetryLang,
} from './liveInputTelemetryApi';

const SESSION_STORAGE_KEY = 'live-input-telemetry-session-id';

function inferTelemetryLang(content: string): LiveInputTelemetryLang {
  if (/[\u3400-\u9fff]/.test(content)) {
    return 'zh';
  }

  const lowered = content.toLowerCase();
  if (
    /\b(sono|sto|stanco|stanca|felice|ansioso|ansiosa|sollevato|sollevata|sollievo|riunione|lezione|lavorando|studiando)\b/.test(lowered)
  ) {
    return 'it';
  }

  return 'en';
}

function getTelemetrySessionId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `telemetry-${Date.now().toString(36)}`;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextId);
  return nextId;
}

function getPlatform(): string | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };

  return navigatorWithUserAgentData.userAgentData?.platform || navigator.platform || undefined;
}

function shouldSkipCloudTelemetry(): boolean {
  return Boolean(import.meta.env.VITEST);
}

export function emitLiveInputClassificationTelemetry(
  rawInput: string,
  classification: LiveInputClassification,
  messageId?: string | null,
): void {
  if (shouldSkipCloudTelemetry()) {
    return;
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return;
  }

  void callLiveInputTelemetryIngestAPI({
    eventType: 'classification',
    rawInput: trimmed,
    inputLength: trimmed.length,
    kind: classification.kind,
    internalKind: classification.internalKind,
    confidence: classification.confidence,
    reasons: collectClassificationReasons(classification),
    relatedActivityId: classification.relatedActivityId,
    containsMoodSignal: classification.containsMoodSignal,
    extractedMood: classification.extractedMood,
    messageId: messageId ?? undefined,
    lang: inferTelemetryLang(trimmed),
    sessionId: getTelemetrySessionId(),
    platform: getPlatform(),
    appVersion: import.meta.env.VITE_APP_VERSION || undefined,
  }).catch((error) => {
    if (import.meta.env.DEV) {
      console.warn('[live-input-telemetry] classification ingest failed', error);
    }
  });
}

export function emitLiveInputCorrectionTelemetry(params: {
  rawInput?: string;
  fromKind: LiveInputTelemetryCorrectionKind;
  toKind: LiveInputTelemetryCorrectionKind;
  messageId?: string;
}): void {
  if (shouldSkipCloudTelemetry()) {
    return;
  }

  const trimmed = params.rawInput?.trim() ?? '';
  void callLiveInputTelemetryIngestAPI({
    eventType: 'correction',
    rawInput: trimmed || undefined,
    inputLength: trimmed.length,
    fromKind: params.fromKind,
    toKind: params.toKind,
    messageId: params.messageId,
    lang: trimmed ? inferTelemetryLang(trimmed) : undefined,
    sessionId: getTelemetrySessionId(),
    platform: getPlatform(),
    appVersion: import.meta.env.VITE_APP_VERSION || undefined,
  }).catch((error) => {
    if (import.meta.env.DEV) {
      console.warn('[live-input-telemetry] correction ingest failed', error);
    }
  });
}

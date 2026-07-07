const LARGE_METADATA_KEYS = new Set([
  'today_narrative_cache_v1',
  'lateral_association_state_v1',
]);

const MAX_AUTH_METADATA_JSON_CHARS = 6000;
const MAX_AUTH_METADATA_STRING_CHARS = 2048;

export interface AuthMetadataSanitizeResult {
  metadata: Record<string, unknown>;
  removedKeys: string[];
  jsonChars: number;
}

function isDataUrl(value: string): boolean {
  return value.trim().toLowerCase().startsWith('data:');
}

function sanitizeValue(key: string, value: unknown, removedKeys: string[]): unknown {
  if (LARGE_METADATA_KEYS.has(key)) {
    removedKeys.push(key);
    return undefined;
  }

  if (typeof value === 'string') {
    if (isDataUrl(value)) {
      removedKeys.push(key);
      return undefined;
    }
    if (value.length > MAX_AUTH_METADATA_STRING_CHARS) {
      removedKeys.push(key);
      return undefined;
    }
    return value;
  }

  if (key === 'login_days' && Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').slice(-90);
  }

  return value;
}

function jsonLength(metadata: Record<string, unknown>): number {
  try {
    return JSON.stringify(metadata).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function sanitizeAuthMetadataForJwt(metadata: Record<string, unknown>): AuthMetadataSanitizeResult {
  const removedKeys: string[] = [];
  const cleanEntries = Object.entries(metadata).flatMap(([key, value]) => {
    const sanitized = sanitizeValue(key, value, removedKeys);
    return sanitized === undefined ? [] : [[key, sanitized] as const];
  });
  const clean = Object.fromEntries(cleanEntries) as Record<string, unknown>;

  if (jsonLength(clean) > MAX_AUTH_METADATA_JSON_CHARS) {
    for (const key of ['user_profile_v2', 'login_days']) {
      if (key in clean) {
        delete clean[key];
        removedKeys.push(key);
      }
      if (jsonLength(clean) <= MAX_AUTH_METADATA_JSON_CHARS) break;
    }
  }

  return {
    metadata: clean,
    removedKeys: Array.from(new Set(removedKeys)),
    jsonChars: jsonLength(clean),
  };
}

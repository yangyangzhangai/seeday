// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/profile/README.md

export interface GeocodeResult {
  label: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

interface OpenMeteoGeocodeItem {
  name?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  feature_code?: string;
}

interface OpenMeteoGeocodeResponse {
  results?: OpenMeteoGeocodeItem[];
}

function buildLabel(item: OpenMeteoGeocodeItem): string {
  const parts = [item.name, item.admin1, item.country]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean);
  return parts.join(', ');
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeToken(input: string): string {
  return input.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function isCountryFeatureCode(featureCode: unknown): boolean {
  if (typeof featureCode !== 'string') return false;
  return /^PCL/.test(featureCode.trim().toUpperCase());
}

function normalizeResult(item: OpenMeteoGeocodeItem): GeocodeResult | null {
  const countryCode = typeof item.country_code === 'string' ? item.country_code.trim().toUpperCase() : '';
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  if (!/^[A-Z]{2}$/.test(countryCode) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const label = buildLabel(item) || countryCode;
  const timezone = typeof item.timezone === 'string' && item.timezone.trim() ? item.timezone.trim() : undefined;

  return {
    label,
    countryCode,
    latitude,
    longitude,
    timezone,
  };
}

export async function geocodeLocationName(query: string, lang: 'zh' | 'en' | 'it'): Promise<GeocodeResult | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  const params = new URLSearchParams({
    name: normalized,
    count: '1',
    language: lang,
    format: 'json',
  });
  const response = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, 5000);
  if (!response.ok) return null;

  const payload = await response.json() as OpenMeteoGeocodeResponse;
  const first = payload.results?.[0];
  if (!first) return null;
  return normalizeResult(first);
}

export async function geocodeCountryName(query: string, lang: 'zh' | 'en' | 'it'): Promise<GeocodeResult | null> {
  const normalized = query.trim();
  if (!normalized) return null;

  const params = new URLSearchParams({
    name: normalized,
    count: '8',
    language: lang,
    format: 'json',
  });
  const response = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, 5000);
  if (!response.ok) return null;

  const payload = await response.json() as OpenMeteoGeocodeResponse;
  const results = payload.results || [];
  if (results.length === 0) return null;

  const explicitCountry = results.find((item) => isCountryFeatureCode(item.feature_code));
  if (explicitCountry) {
    return normalizeResult(explicitCountry);
  }

  const queryToken = normalizeToken(normalized);
  const nameMatched = results.find((item) => normalizeToken(String(item.name || '')) === queryToken && !item.admin1);
  if (nameMatched) {
    return normalizeResult(nameMatched);
  }

  return null;
}

export async function reverseGeocodeLocation(latitude: number, longitude: number): Promise<GeocodeResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    count: '1',
    format: 'json',
  });
  const response = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/reverse?${params.toString()}`, 5000);
  if (!response.ok) return null;

  const payload = await response.json() as OpenMeteoGeocodeResponse;
  const first = payload.results?.[0];
  if (!first) return null;
  return normalizeResult(first);
}

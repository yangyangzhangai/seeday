interface OpenMeteoAirQualityResponse {
  current?: {
    pm2_5?: number;
    pm10?: number;
    european_aqi?: number;
  };
}

export interface RawAirQualitySnapshot {
  pm25?: number;
  pm10?: number;
  europeanAqi?: number;
}

interface AirQualityProviderInput {
  latitude?: number;
  longitude?: number;
  timeoutMs?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function fetchAirQualitySnapshot(input: AirQualityProviderInput): Promise<RawAirQualitySnapshot | null> {
  const { latitude, longitude, timeoutMs = 800 } = input;
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'pm2_5,pm10,european_aqi',
      timezone: 'auto',
    });
    const response = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = await response.json() as OpenMeteoAirQualityResponse;
    const current = payload.current;
    if (!current) return null;

    return {
      pm25: current.pm2_5,
      pm10: current.pm10,
      europeanAqi: current.european_aqi,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

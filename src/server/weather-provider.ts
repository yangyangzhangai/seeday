interface OpenMeteoCurrentResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    rain?: number;
    snowfall?: number;
    wind_speed_10m?: number;
    wind_gusts_10m?: number;
  };
}

export interface RawWeatherSnapshot {
  temperatureC?: number;
  weatherCode?: number;
  rainMm?: number;
  snowfallCm?: number;
  windSpeedKmh?: number;
  windGustKmh?: number;
}

interface WeatherProviderInput {
  latitude?: number;
  longitude?: number;
  timeoutMs?: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export async function fetchWeatherSnapshot(input: WeatherProviderInput): Promise<RawWeatherSnapshot | null> {
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
      current: 'temperature_2m,weather_code,rain,snowfall,wind_speed_10m,wind_gusts_10m',
      timezone: 'auto',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const payload = await response.json() as OpenMeteoCurrentResponse;
    const current = payload.current;
    if (!current) return null;

    return {
      temperatureC: current.temperature_2m,
      weatherCode: current.weather_code,
      rainMm: current.rain,
      snowfallCm: current.snowfall,
      windSpeedKmh: current.wind_speed_10m,
      windGustKmh: current.wind_gusts_10m,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

import { describe, expect, it } from 'vitest';
import { buildWeatherAlerts } from './weather-alerts';

describe('buildWeatherAlerts', () => {
  it('raises strong wind alert by gust threshold', () => {
    const alerts = buildWeatherAlerts({
      weather: { windGustKmh: 70 },
      airQuality: null,
    });

    expect(alerts).toContain('strong_wind_watch');
  });

  it('raises haze alert by pm2_5 threshold', () => {
    const alerts = buildWeatherAlerts({
      weather: null,
      airQuality: { pm25: 82 },
    });

    expect(alerts).toContain('haze_watch');
  });

  it('returns empty list when no threshold is met', () => {
    const alerts = buildWeatherAlerts({
      weather: { windGustKmh: 20, windSpeedKmh: 15 },
      airQuality: { pm25: 20, pm10: 40, europeanAqi: 20 },
    });

    expect(alerts).toEqual([]);
  });
});

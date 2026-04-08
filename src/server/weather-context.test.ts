import { describe, expect, it } from 'vitest';
import { buildWeatherContext } from './weather-context';

describe('buildWeatherContext', () => {
  it('maps rain and wind to combined conditions', () => {
    const result = buildWeatherContext({
      temperatureC: 17.6,
      weatherCode: 3,
      rainMm: 3,
      windSpeedKmh: 38,
      windGustKmh: 55,
    });

    expect(result.temperatureC).toBe(18);
    expect(result.conditions).toEqual(expect.arrayContaining(['overcast', 'rain_medium', 'windy']));
    expect(result.source).toBe('api');
  });

  it('returns fallback on missing snapshot', () => {
    expect(buildWeatherContext(null)).toEqual({
      temperatureC: null,
      conditions: ['unknown'],
      source: 'fallback',
    });
  });
});

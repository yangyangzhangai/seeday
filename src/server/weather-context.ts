import type { WeatherCondition, WeatherContextV2 } from '../types/annotation.js';
import type { RawWeatherSnapshot } from './weather-provider.js';

function addCondition(set: Set<WeatherCondition>, value: WeatherCondition): void {
  set.add(value);
}

function mapWeatherCode(weatherCode: number | undefined, set: Set<WeatherCondition>): void {
  if (typeof weatherCode !== 'number') return;

  if (weatherCode === 0) {
    addCondition(set, 'sunny');
    return;
  }
  if (weatherCode === 1 || weatherCode === 2) {
    addCondition(set, 'cloudy');
    return;
  }
  if (weatherCode === 3) {
    addCondition(set, 'overcast');
    return;
  }
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    addCondition(set, 'snow');
    return;
  }
  if (weatherCode === 96 || weatherCode === 99) {
    addCondition(set, 'hail');
  }
}

function mapRain(rainMm: number | undefined, set: Set<WeatherCondition>): void {
  if (typeof rainMm !== 'number' || rainMm <= 0) return;
  if (rainMm < 2) {
    addCondition(set, 'rain_light');
    return;
  }
  if (rainMm < 8) {
    addCondition(set, 'rain_medium');
    return;
  }
  addCondition(set, 'rain_heavy');
}

function mapWind(windSpeedKmh: number | undefined, windGustKmh: number | undefined, set: Set<WeatherCondition>): void {
  if (
    (typeof windSpeedKmh === 'number' && windSpeedKmh >= 35)
    || (typeof windGustKmh === 'number' && windGustKmh >= 50)
  ) {
    addCondition(set, 'windy');
  }
}

export function buildWeatherContext(snapshot: RawWeatherSnapshot | null): WeatherContextV2 {
  if (!snapshot) {
    return {
      temperatureC: null,
      conditions: ['unknown'],
      source: 'fallback',
    };
  }

  const conditions = new Set<WeatherCondition>();
  mapWeatherCode(snapshot.weatherCode, conditions);
  mapRain(snapshot.rainMm, conditions);
  mapWind(snapshot.windSpeedKmh, snapshot.windGustKmh, conditions);

  return {
    temperatureC: typeof snapshot.temperatureC === 'number' ? Math.round(snapshot.temperatureC) : null,
    conditions: conditions.size > 0 ? [...conditions] : ['unknown'],
    source: 'api',
  };
}

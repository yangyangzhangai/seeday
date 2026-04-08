import type { WeatherAlert } from '../types/annotation.js';
import type { RawAirQualitySnapshot } from './air-quality-provider.js';
import type { RawWeatherSnapshot } from './weather-provider.js';

interface WeatherAlertInput {
  weather: RawWeatherSnapshot | null;
  airQuality: RawAirQualitySnapshot | null;
}

export function buildWeatherAlerts(input: WeatherAlertInput): WeatherAlert[] {
  const alerts = new Set<WeatherAlert>();

  const gust = input.weather?.windGustKmh;
  const speed = input.weather?.windSpeedKmh;
  if ((typeof gust === 'number' && gust >= 62) || (typeof speed === 'number' && speed >= 45)) {
    alerts.add('strong_wind_watch');
  }

  const pm25 = input.airQuality?.pm25;
  const pm10 = input.airQuality?.pm10;
  const aqi = input.airQuality?.europeanAqi;
  if (
    (typeof pm25 === 'number' && pm25 >= 75)
    || (typeof pm10 === 'number' && pm10 >= 150)
    || (typeof aqi === 'number' && aqi >= 80)
  ) {
    alerts.add('haze_watch');
  }

  return [...alerts];
}

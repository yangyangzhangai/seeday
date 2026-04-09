// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/profile/README.md
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { geocodeLocationName, reverseGeocodeLocation } from '../../../services/location/geocode';

interface RegionSettingsPanelProps {
  onClose: () => void;
}

function detectUiLang(i18nLang: string | undefined): 'zh' | 'en' | 'it' {
  const normalized = (i18nLang || 'en').toLowerCase();
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('it')) return 'it';
  return 'en';
}

function getCurrentPositionAsync(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('geolocation_not_supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60_000,
    });
  });
}

export const RegionSettingsPanel: React.FC<RegionSettingsPanelProps> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const { user, updateLocationMetadata } = useAuthStore();
  const lang = detectUiLang(i18n.language);

  const currentLabel = useMemo(() => {
    const meta = user?.user_metadata || {};
    const label = typeof meta.location_label === 'string' ? meta.location_label.trim() : '';
    const countryCode = typeof meta.country_code === 'string' ? meta.country_code.trim().toUpperCase() : '';
    if (label) return label;
    if (/^[A-Z]{2}$/.test(countryCode)) return countryCode;
    return t('profile_region_not_set');
  }, [t, user]);

  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSaveByQuery = async () => {
    const normalized = query.trim();
    if (!normalized || isSaving || isLocating) return;

    setErrorText(null);
    setIsSaving(true);
    try {
      const geocode = await geocodeLocationName(normalized, lang);
      if (!geocode) {
        setErrorText(t('profile_region_not_found'));
        return;
      }

      const { error } = await updateLocationMetadata({
        countryCode: geocode.countryCode,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
        locationLabel: geocode.label,
        source: 'manual_geocode',
      });
      if (error) {
        setErrorText(t('profile_region_save_error'));
        return;
      }

      onClose();
    } catch {
      setErrorText(t('profile_region_save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    if (isLocating || isSaving) return;

    setErrorText(null);
    setIsLocating(true);
    try {
      const position = await getCurrentPositionAsync();
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const reverse = await reverseGeocodeLocation(latitude, longitude);
      if (!reverse) {
        setErrorText(t('profile_region_not_found'));
        return;
      }

      const { error } = await updateLocationMetadata({
        countryCode: reverse.countryCode,
        latitude,
        longitude,
        locationLabel: reverse.label,
        source: 'device_gps',
      });
      if (error) {
        setErrorText(t('profile_region_save_error'));
        return;
      }

      onClose();
    } catch {
      setErrorText(t('profile_region_locate_error'));
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="px-4 pb-3 pt-1">
      <p className="text-[11px] text-slate-500">{t('profile_region_settings_desc')}</p>
      <p className="mt-1 text-[11px] text-slate-500">{t('profile_region_current', { value: currentLabel })}</p>

      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('profile_region_placeholder')}
          className="min-h-9 flex-1 rounded-lg border border-[#CBE7D7] bg-white/85 px-3 text-xs text-slate-700 outline-none"
        />
        <button
          type="button"
          onClick={handleSaveByQuery}
          disabled={isSaving || isLocating || !query.trim()}
          className="min-h-9 rounded-lg border border-transparent px-3 text-xs font-medium text-[#355643] disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, rgba(236,248,241,0.96) 0%, rgba(213,236,222,0.92) 100%)',
            boxShadow: '0 4px 12px rgba(103,154,121,0.15)',
          }}
        >
          {isSaving ? t('profile_region_saving') : t('profile_region_save')}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating || isSaving}
          className="min-h-9 rounded-lg border border-[#CBE7D7] bg-white/80 px-3 text-xs text-[#355643] transition hover:bg-white disabled:opacity-60"
        >
          {isLocating ? t('profile_region_locating') : t('profile_region_use_current')}
        </button>
      </div>

      {errorText ? <p className="mt-2 text-xs text-red-500">{errorText}</p> : null}
    </div>
  );
};

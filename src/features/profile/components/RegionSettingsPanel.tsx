// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/profile/README.md
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { geocodeLocationName } from '../../../services/location/geocode';

interface RegionSettingsPanelProps {
  onClose: () => void;
}

function detectUiLang(i18nLang: string | undefined): 'zh' | 'en' | 'it' {
  const normalized = (i18nLang || 'en').toLowerCase();
  if (normalized.startsWith('zh')) return 'zh';
  if (normalized.startsWith('it')) return 'it';
  return 'en';
}

export const RegionSettingsPanel: React.FC<RegionSettingsPanelProps> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const { updateLocationMetadata } = useAuthStore();
  const lang = detectUiLang(i18n.language);

  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleSaveByQuery = async () => {
    const normalized = query.trim();
    if (!normalized || isSaving) return;

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

  return (
    <div className="px-4 pb-3 pt-1">
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
          disabled={isSaving || !query.trim()}
          className="min-h-9 rounded-xl border border-transparent px-4 text-xs font-semibold text-[#5F7A63] disabled:opacity-60"
          style={{
            background: 'rgba(144, 212, 122, 0.20)',
            boxShadow: '0px 2px 2px #C8C8C8',
          }}
        >
          {isSaving ? t('profile_region_saving') : t('profile_region_save')}
        </button>
      </div>

      {errorText ? <p className="mt-2 text-xs text-red-500">{errorText}</p> : null}
    </div>
  );
};

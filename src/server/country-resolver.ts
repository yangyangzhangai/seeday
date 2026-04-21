// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md

const TIMEZONE_COUNTRY_FALLBACKS: Array<{ pattern: RegExp; countryCode: string }> = [
  { pattern: /^Asia\/Shanghai$/i, countryCode: 'CN' },
  { pattern: /^Asia\/Hong_Kong$/i, countryCode: 'HK' },
  { pattern: /^Asia\/Macao$/i, countryCode: 'MO' },
  { pattern: /^Asia\/Taipei$/i, countryCode: 'TW' },
  { pattern: /^Asia\/Tokyo$/i, countryCode: 'JP' },
  { pattern: /^Asia\/Seoul$/i, countryCode: 'KR' },
  { pattern: /^Europe\/Rome$/i, countryCode: 'IT' },
  { pattern: /^Europe\/London$/i, countryCode: 'GB' },
  { pattern: /^Europe\/Paris$/i, countryCode: 'FR' },
  { pattern: /^Europe\/Berlin$/i, countryCode: 'DE' },
  { pattern: /^Europe\/Madrid$/i, countryCode: 'ES' },
  { pattern: /^America\/New_York$/i, countryCode: 'US' },
  { pattern: /^America\/Chicago$/i, countryCode: 'US' },
  { pattern: /^America\/Denver$/i, countryCode: 'US' },
  { pattern: /^America\/Los_Angeles$/i, countryCode: 'US' },
  { pattern: /^America\/Toronto$/i, countryCode: 'CA' },
  { pattern: /^America\/Vancouver$/i, countryCode: 'CA' },
  { pattern: /^Australia\/Sydney$/i, countryCode: 'AU' },
  { pattern: /^Australia\/Melbourne$/i, countryCode: 'AU' },
  { pattern: /^Pacific\/Auckland$/i, countryCode: 'NZ' },
];

export interface ResolveCountryCodeInput {
  countryCode?: string;
  timezone?: string;
}

export interface ResolveCountryCodeResult {
  countryCode: string;
  source: 'profile' | 'timezone' | 'default';
}

function normalizeCountryCode(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const value = input.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) return undefined;
  return value;
}

function resolveByTimezone(timezone: unknown): string | undefined {
  if (typeof timezone !== 'string') return undefined;
  const value = timezone.trim();
  if (!value) return undefined;
  const matched = TIMEZONE_COUNTRY_FALLBACKS.find((item) => item.pattern.test(value));
  return matched?.countryCode;
}

export function resolveCountryCode(input: ResolveCountryCodeInput): ResolveCountryCodeResult {
  const fromProfile = normalizeCountryCode(input.countryCode);
  if (fromProfile) {
    return { countryCode: fromProfile, source: 'profile' };
  }

  const fromTimezone = resolveByTimezone(input.timezone);
  if (fromTimezone) {
    return { countryCode: fromTimezone, source: 'timezone' };
  }

  return { countryCode: 'CN', source: 'default' };
}

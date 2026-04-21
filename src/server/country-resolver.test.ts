import { describe, expect, it } from 'vitest';
import { resolveCountryCode } from './country-resolver';

describe('country-resolver', () => {
  it('uses profile country code first', () => {
    const result = resolveCountryCode({
      countryCode: 'it',
      timezone: 'Asia/Shanghai',
    });

    expect(result.countryCode).toBe('IT');
    expect(result.source).toBe('profile');
  });

  it('falls back to timezone country', () => {
    const result = resolveCountryCode({
      timezone: 'Europe/Rome',
    });

    expect(result.countryCode).toBe('IT');
    expect(result.source).toBe('timezone');
  });

  it('uses default country when both are missing', () => {
    const result = resolveCountryCode({});

    expect(result.countryCode).toBe('CN');
    expect(result.source).toBe('default');
  });
});

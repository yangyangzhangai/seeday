// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import { generateKeyPairSync, verify } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAppleApiToken } from './subscription';

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

describe('buildAppleApiToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('emits an ES256 JWS signature in IEEE-P1363 format', () => {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    vi.stubEnv('APPLE_IAP_ISSUER_ID', 'issuer-id');
    vi.stubEnv('APPLE_IAP_KEY_ID', 'key-id');
    vi.stubEnv('APPLE_IAP_PRIVATE_KEY', privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }).toString());

    const token = buildAppleApiToken('com.seeday.app');
    const [header, payload, signature] = token.split('.');
    const signingInput = `${header}.${payload}`;
    const signatureBytes = decodeBase64Url(signature);

    expect(signatureBytes).toHaveLength(64);
    expect(verify(
      'sha256',
      Buffer.from(signingInput),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      signatureBytes,
    )).toBe(true);
  });
});

// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> api/README.md
import { generateKeyPairSync, verify } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAppleApiToken, fetchAppleTransactionAcrossEnvironments } from './subscription';

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

describe('buildAppleApiToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it('falls back to sandbox when production returns 401 for a sandbox transaction', async () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    vi.stubEnv('APPLE_IAP_ISSUER_ID', 'issuer-id');
    vi.stubEnv('APPLE_IAP_KEY_ID', 'key-id');
    vi.stubEnv('APPLE_IAP_PRIVATE_KEY', privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }).toString());

    const payload = Buffer.from(JSON.stringify({
      bundleId: 'com.seeday.app',
      productId: 'seeday.pro.monthly',
      transactionId: 'sandbox-transaction',
    })).toString('base64url');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        signedTransactionInfo: `header.${payload}.signature`,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAppleTransactionAcrossEnvironments(
      'com.seeday.app',
      'sandbox-transaction',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://api.storekit.apple.com/');
    expect(String(fetchMock.mock.calls[1][0])).toContain('https://api.storekit-sandbox.apple.com/');
    expect(result?.environment).toBe('sandbox');
    expect(result?.payload.transactionId).toBe('sandbox-transaction');
  });
});

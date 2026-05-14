import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildVerificationTokenMessage,
  createSignedVerificationToken,
  verifyVerificationToken,
} from '@/lib/verificationToken';

vi.mock('ethers', () => ({
  ethers: {
    utils: {
      randomBytes: (length: number) => new Uint8Array(length).fill(1),
      hexlify: (bytes: Uint8Array) =>
        `0x${Array.from(bytes)
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')}`,
      isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
      verifyMessage: (_message: string, signature: string) => {
        const [prefix, address] = signature.split(':');
        if (prefix !== 'sig' || !address) {
          throw new Error('invalid signature');
        }
        return address;
      },
    },
  },
}));

describe('verificationToken', () => {
  const validHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
  const issuer = '0x1111111111111111111111111111111111111111' as const;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-13T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds a deterministic signature message', () => {
    const message = buildVerificationTokenMessage({
      v: '1',
      h: validHash,
      iss: issuer,
      iat: 1,
      exp: 2,
      n: '0x1234',
    });

    expect(message).toContain('zkCredentials Verification Link');
    expect(message).toContain(`hash:${validHash}`);
    expect(message).toContain(`issuer:${issuer}`);
    expect(message).toContain('nonce:0x1234');
  });

  it('creates and verifies a signed token', async () => {
    const signMessage = vi.fn(async () => `sig:${issuer}`);

    const token = await createSignedVerificationToken(validHash, issuer, signMessage, 3600);
    const result = verifyVerificationToken(token);

    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(token.startsWith('v1.')).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.payload?.h).toBe(validHash);
    expect(result.payload?.iss).toBe(issuer);
    expect(result.signer).toBe(issuer);
  });

  it('enforces minimum ttl when creating tokens', async () => {
    const signMessage = vi.fn(async () => `sig:${issuer}`);

    const token = await createSignedVerificationToken(validHash, issuer, signMessage, 1);
    const result = verifyVerificationToken(token);

    expect(result.valid).toBe(true);
    expect((result.payload?.exp ?? 0) - (result.payload?.iat ?? 0)).toBe(60);
  });

  it('rejects expired tokens', async () => {
    const signMessage = vi.fn(async () => `sig:${issuer}`);
    const token = await createSignedVerificationToken(validHash, issuer, signMessage, 60);

    vi.advanceTimersByTime(61_000);

    expect(verifyVerificationToken(token)).toEqual({
      valid: false,
      reason: 'Verification link has expired',
    });
  });

  it('rejects tampered signatures', async () => {
    const signMessage = vi.fn(async () => `sig:${issuer}`);
    const token = await createSignedVerificationToken(validHash, issuer, signMessage, 3600);
    const [prefix, payload] = token.split('.');
    const tampered = `${prefix}.${payload}.${btoa('sig:0x2222222222222222222222222222222222222222')}`;

    expect(verifyVerificationToken(tampered)).toEqual({
      valid: false,
      reason: 'Token signature mismatch',
    });
  });

  it('rejects malformed tokens and invalid hashes', async () => {
    await expect(
      createSignedVerificationToken(
        '0x1234' as `0x${string}`,
        issuer,
        async () => `sig:${issuer}`
      )
    ).rejects.toThrow('Invalid document hash for verification token');

    expect(verifyVerificationToken('not-a-token')).toEqual({
      valid: false,
      reason: 'Invalid token format',
    });
  });
});

import { ethers } from 'ethers';

export interface VerificationTokenPayload {
  v: '1';
  h: `0x${string}`; // document hash
  iss: `0x${string}`; // signer address
  iat: number; // issued-at (unix seconds)
  exp: number; // expiry (unix seconds)
  n: string; // nonce
}

export interface VerificationTokenValidationResult {
  valid: boolean;
  payload?: VerificationTokenPayload;
  signer?: `0x${string}`;
  reason?: string;
}

const TOKEN_PREFIX = 'v1';

function base64UrlEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function isHexHash(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

export function buildVerificationTokenMessage(payload: VerificationTokenPayload): string {
  return [
    'zkCredentials Verification Link',
    `version:${payload.v}`,
    `hash:${payload.h.toLowerCase()}`,
    `issuer:${payload.iss.toLowerCase()}`,
    `iat:${payload.iat}`,
    `exp:${payload.exp}`,
    `nonce:${payload.n}`,
  ].join('\n');
}

export async function createSignedVerificationToken(
  documentHash: `0x${string}`,
  issuerAddress: `0x${string}`,
  signMessage: (message: string) => Promise<string>,
  ttlSeconds: number = 60 * 60 * 24 * 7
): Promise<string> {
  if (!isHexHash(documentHash)) {
    throw new Error('Invalid document hash for verification token');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: VerificationTokenPayload = {
    v: '1',
    h: documentHash.toLowerCase() as `0x${string}`,
    iss: issuerAddress.toLowerCase() as `0x${string}`,
    iat: now,
    exp: now + Math.max(60, ttlSeconds),
    n: ethers.utils.hexlify(ethers.utils.randomBytes(12)),
  };

  const message = buildVerificationTokenMessage(payload);
  const signature = await signMessage(message);

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signatureEncoded = base64UrlEncode(signature);
  return `${TOKEN_PREFIX}.${payloadEncoded}.${signatureEncoded}`;
}

export function verifyVerificationToken(token: string): VerificationTokenValidationResult {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
      return { valid: false, reason: 'Invalid token format' };
    }

    const payloadJson = base64UrlDecode(parts[1]);
    const signature = base64UrlDecode(parts[2]);
    const payload = JSON.parse(payloadJson) as VerificationTokenPayload;

    if (payload.v !== '1') {
      return { valid: false, reason: 'Unsupported token version' };
    }
    if (!isHexHash(payload.h)) {
      return { valid: false, reason: 'Token hash is invalid' };
    }
    if (!ethers.utils.isAddress(payload.iss)) {
      return { valid: false, reason: 'Token issuer is invalid' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return { valid: false, reason: 'Verification link has expired' };
    }

    const message = buildVerificationTokenMessage(payload);
    const recovered = ethers.utils.verifyMessage(message, signature).toLowerCase() as `0x${string}`;
    if (recovered !== payload.iss.toLowerCase()) {
      return { valid: false, reason: 'Token signature mismatch' };
    }

    return {
      valid: true,
      payload: {
        ...payload,
        h: payload.h.toLowerCase() as `0x${string}`,
        iss: payload.iss.toLowerCase() as `0x${string}`,
      },
      signer: recovered,
    };
  } catch {
    return { valid: false, reason: 'Failed to verify token' };
  }
}

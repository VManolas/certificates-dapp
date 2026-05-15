import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeQRCodePayload,
  generateQRCodePayload,
  getQRCodeSize,
  isValidQRCodePayload,
} from '@/lib/qrCode';

describe('qrCode', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });

  it('generates a payload with parsed metadata and privacy fields', () => {
    const encoded = generateQRCodePayload(
      {
        documentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        metadataURI: JSON.stringify({ program: 'Computer Science' }),
        graduationYear: 2025,
        studentWallet: '0x1111111111111111111111111111111111111111',
        isRevoked: false,
      },
      'MIT',
      {
        includeWallet: true,
        includeInitials: true,
        initials: 'AB',
      }
    );

    const decoded = decodeQRCodePayload(encoded);
    expect(decoded).toEqual({
      program: 'Computer Science',
      university: 'MIT',
      graduationYear: 2025,
      status: 'Verified',
      documentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      version: '1.0',
      generatedAt: 1_700_000_000_000,
      studentWallet: '0x1111111111111111111111111111111111111111',
      studentInitials: 'AB',
    });
  });

  it('falls back to raw metadataURI and current year when metadata is not json', () => {
    vi.spyOn(globalThis.Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.setSystemTime?.(new Date('2026-05-14T12:00:00.000Z'));

    const encoded = generateQRCodePayload(
      {
        documentHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        metadataURI: 'Bachelor of Arts',
        isRevoked: true,
      },
      'Harvard',
      {
        includeWallet: false,
        includeInitials: false,
      }
    );

    const decoded = decodeQRCodePayload(encoded);
    expect(decoded.program).toBe('Bachelor of Arts');
    expect(decoded.university).toBe('Harvard');
    expect(decoded.status).toBe('Revoked');
    expect(decoded.graduationYear).toBe(2026);
    expect(decoded.studentWallet).toBeUndefined();
    expect(decoded.studentInitials).toBeUndefined();
  });

  it('throws when documentHash is missing', () => {
    expect(() =>
      generateQRCodePayload(
        {
          metadataURI: 'Program',
        },
        'MIT',
        {
          includeWallet: false,
          includeInitials: false,
        }
      )
    ).toThrow('Certificate documentHash is required for QR code generation');
  });

  it('rejects unsupported formats and malformed payloads', () => {
    expect(() => decodeQRCodePayload('not-v1')).toThrow('Unsupported QR code version');
    expect(() => decodeQRCodePayload('V1:not-base64')).toThrow('Failed to decode QR code: invalid format');

    const badPayload = `V1:${btoa(JSON.stringify({ university: 'MIT' }))}`;
    expect(() => decodeQRCodePayload(badPayload)).toThrow('Invalid QR code payload: missing required fields');
  });

  it('validates payload structure correctly', () => {
    expect(
      isValidQRCodePayload({
        program: 'CS',
        university: 'MIT',
        graduationYear: 2025,
        status: 'Verified',
        version: '1.0',
        generatedAt: 123,
      })
    ).toBe(true);

    expect(
      isValidQRCodePayload({
        program: 'CS',
        university: 'MIT',
        graduationYear: '2025',
        status: 'Verified',
        version: '1.0',
        generatedAt: 123,
      })
    ).toBe(false);
  });

  it('scales QR size based on payload length', () => {
    const smallPayload = {
      program: 'A',
      university: 'B',
      graduationYear: 2025,
      status: 'Verified' as const,
      version: '1.0',
      generatedAt: 1,
    };

    const mediumPayload = {
      ...smallPayload,
      program: 'Computer Science',
      university: 'MIT',
      documentHash: '0xaaaa',
    };

    const largePayload = {
      ...mediumPayload,
      university: 'Massachusetts Institute of Technology Department of Computer Science and Artificial Intelligence Laboratory',
      program: 'Extremely Long Program Name Designed To Exceed The Medium Payload Threshold',
      studentWallet: '0x1111111111111111111111111111111111111111',
      studentInitials: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    };

    expect(getQRCodeSize(smallPayload as any)).toBe(200);
    expect(getQRCodeSize(mediumPayload as any)).toBe(224);
    expect(getQRCodeSize(largePayload as any)).toBe(256);
  });
});

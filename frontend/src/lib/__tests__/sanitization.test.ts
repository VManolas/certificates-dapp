// src/lib/__tests__/sanitization.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeString,
  sanitizeAddress,
  sanitizeMetadataUri,
  sanitizeCertificateMetadata,
  validateBigInt,
  validatePdfFile,
  RateLimiter,
} from '../sanitization';

// Mock viem's isAddress to work in test environment
vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    isAddress: (address: string) => {
      // Basic Ethereum address validation for tests
      return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address);
    },
  };
});

describe('sanitization utilities', () => {
  describe('sanitizeString', () => {
    it('removes control characters and null bytes', () => {
      const input = 'Hello\x00World\x1F!';
      expect(sanitizeString(input)).toBe('HelloWorld!');
    });

    it('trims whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('enforces maximum length', () => {
      const longString = 'a'.repeat(1000);
      expect(sanitizeString(longString, 100)).toHaveLength(100);
    });

    it('returns empty string for non-string input', () => {
      expect(sanitizeString(123 as unknown as string)).toBe('');
    });

    it('handles empty strings', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('sanitizeAddress', () => {
    it('accepts valid Ethereum addresses', () => {
      const validAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
      expect(sanitizeAddress(validAddress)).toBe(validAddress);
    });

    it('trims whitespace from addresses', () => {
      const address = '  0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0  ';
      expect(sanitizeAddress(address)).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
    });

    it('rejects invalid addresses', () => {
      expect(sanitizeAddress('invalid')).toBeNull();
      expect(sanitizeAddress('0x123')).toBeNull();
      expect(sanitizeAddress('0xZZZZ')).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(sanitizeAddress(null as unknown as string)).toBeNull();
      expect(sanitizeAddress(undefined as unknown as string)).toBeNull();
    });

    it('handles checksummed addresses', () => {
      const checksummed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
      expect(sanitizeAddress(checksummed)).toBe(checksummed);
    });
  });

  describe('sanitizeMetadataUri', () => {
    it('accepts valid IPFS URIs', () => {
      const uri = 'ipfs://QmX...';
      expect(sanitizeMetadataUri(uri)).toBe(uri);
    });

    it('accepts valid HTTPS URIs', () => {
      const uri = 'https://example.com/metadata.json';
      expect(sanitizeMetadataUri(uri)).toBe(uri);
    });

    it('accepts base64 data URIs', () => {
      const uri = 'data:application/json;base64,eyJ0ZXN0IjoidHJ1ZSJ9';
      expect(sanitizeMetadataUri(uri)).toBe(uri);
    });

    it('rejects javascript: protocol', () => {
      expect(sanitizeMetadataUri('javascript:alert(1)')).toBeNull();
    });

    it('rejects data:text/html URIs', () => {
      expect(sanitizeMetadataUri('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('rejects invalid protocols', () => {
      expect(sanitizeMetadataUri('ftp://example.com')).toBeNull();
      expect(sanitizeMetadataUri('file:///etc/passwd')).toBeNull();
    });

    it('enforces maximum length', () => {
      const longUri = 'https://' + 'a'.repeat(3000);
      expect(sanitizeMetadataUri(longUri)).toBeNull();
    });
  });

  describe('sanitizeCertificateMetadata', () => {
    it('sanitizes allowed fields', () => {
      const metadata = {
        studentName: 'John Doe',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        graduationDate: '2025-05-15',
        gpa: '3.8',
        honors: 'Magna Cum Laude',
        additionalInfo: 'Outstanding achievement award',
        maliciousField: '<script>alert(1)</script>',
      };

      const result = sanitizeCertificateMetadata(metadata);

      expect(result.studentName).toBe('John Doe');
      expect(result.degree).toBe('Bachelor of Science');
      expect(result.fieldOfStudy).toBe('Computer Science');
      expect(result.graduationDate).toBe('2025-05-15');
      expect(result.gpa).toBe('3.8');
      expect(result.honors).toBe('Magna Cum Laude');
      expect(result.additionalInfo).toBe('Outstanding achievement award');
      expect(result.maliciousField).toBeUndefined();
    });

    it('enforces length limits per field', () => {
      const metadata = {
        studentName: 'A'.repeat(300),
        additionalInfo: 'B'.repeat(2000),
      };

      const result = sanitizeCertificateMetadata(metadata);

      expect(result.studentName).toHaveLength(200);
      expect(result.additionalInfo).toHaveLength(1000);
    });

    it('filters out non-string values', () => {
      const metadata = {
        studentName: 123,
        degree: true,
        fieldOfStudy: null,
      };

      const result = sanitizeCertificateMetadata(metadata);

      expect(result.studentName).toBeUndefined();
      expect(result.degree).toBeUndefined();
      expect(result.fieldOfStudy).toBeUndefined();
    });
  });

  describe('validateBigInt', () => {
    it('accepts valid bigint values', () => {
      expect(validateBigInt(100n)).toBe(true);
      expect(validateBigInt(0n)).toBe(true);
      expect(validateBigInt(2n ** 255n)).toBe(true);
    });

    it('rejects values below minimum', () => {
      expect(validateBigInt(-1n)).toBe(false);
      expect(validateBigInt(5n, 10n, 100n)).toBe(false);
    });

    it('rejects values above maximum', () => {
      expect(validateBigInt(101n, 0n, 100n)).toBe(false);
    });

    it('accepts values at boundaries', () => {
      expect(validateBigInt(0n, 0n, 100n)).toBe(true);
      expect(validateBigInt(100n, 0n, 100n)).toBe(true);
    });

    it('rejects non-bigint values', () => {
      expect(validateBigInt(123 as unknown as bigint)).toBe(false);
      expect(validateBigInt('123' as unknown as bigint)).toBe(false);
    });
  });

  describe('validatePdfFile', () => {
    it('accepts valid PDF files', () => {
      const validPdf = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
      const result = validatePdfFile(validPdf);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects non-PDF files', () => {
      const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const result = validatePdfFile(textFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('rejects files exceeding maximum size', () => {
      const largeContent = new Array(11 * 1024 * 1024).fill(0); // 11MB
      const largeFile = new File(largeContent, 'large.pdf', { type: 'application/pdf' });
      const result = validatePdfFile(largeFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('rejects empty files', () => {
      const emptyFile = new File([], 'empty.pdf', { type: 'application/pdf' });
      const result = validatePdfFile(emptyFile);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File is empty');
    });

    it('accepts custom maximum size', () => {
      const content = new Array(12 * 1024 * 1024).fill(0); // 12MB
      const file = new File(content, 'test.pdf', { type: 'application/pdf' });
      
      const resultDefault = validatePdfFile(file);
      expect(resultDefault.valid).toBe(false);

      const resultCustom = validatePdfFile(file, 15 * 1024 * 1024);
      expect(resultCustom.valid).toBe(true);
    });

    it('returns error message for null file', () => {
      const result = validatePdfFile(null as unknown as File);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });
  });

  describe('RateLimiter', () => {
    it('allows requests within limit', () => {
      const limiter = new RateLimiter(3, 1000);

      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(true);
      expect(limiter.isAllowed('test')).toBe(true);
    });

    it('blocks requests exceeding limit', () => {
      const limiter = new RateLimiter(3, 1000);

      limiter.isAllowed('test');
      limiter.isAllowed('test');
      limiter.isAllowed('test');

      expect(limiter.isAllowed('test')).toBe(false);
    });

    it('tracks different keys independently', () => {
      const limiter = new RateLimiter(2, 1000);

      limiter.isAllowed('action1');
      limiter.isAllowed('action1');
      limiter.isAllowed('action2');
      limiter.isAllowed('action2');

      expect(limiter.isAllowed('action1')).toBe(false);
      expect(limiter.isAllowed('action2')).toBe(false);
      expect(limiter.isAllowed('action3')).toBe(true);
    });

    it('resets after time window', async () => {
      const limiter = new RateLimiter(2, 100); // 100ms window

      limiter.isAllowed('test');
      limiter.isAllowed('test');
      expect(limiter.isAllowed('test')).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(limiter.isAllowed('test')).toBe(true);
    });

    it('reports remaining attempts correctly', () => {
      const limiter = new RateLimiter(5, 1000);

      expect(limiter.getRemainingAttempts('test')).toBe(5);
      limiter.isAllowed('test');
      expect(limiter.getRemainingAttempts('test')).toBe(4);
      limiter.isAllowed('test');
      expect(limiter.getRemainingAttempts('test')).toBe(3);
    });

    it('can be manually reset', () => {
      const limiter = new RateLimiter(2, 1000);

      limiter.isAllowed('test');
      limiter.isAllowed('test');
      expect(limiter.isAllowed('test')).toBe(false);

      limiter.reset('test');
      expect(limiter.isAllowed('test')).toBe(true);
    });
  });
});

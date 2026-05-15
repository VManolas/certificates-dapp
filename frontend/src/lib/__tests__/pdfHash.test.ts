import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockValidatePDFFile = vi.fn();
const mockGetDocument = vi.fn();
const mockSha256ToString = vi.fn();
const mockWordArrayCreate = vi.fn();
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
  },
}));

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
}));

vi.mock('crypto-js', () => ({
  default: {
    lib: {
      WordArray: {
        create: (...args: unknown[]) => mockWordArrayCreate(...args),
      },
    },
    SHA256: () => ({
      toString: (...args: unknown[]) => mockSha256ToString(...args),
    }),
  },
}));

vi.mock('@/lib/pdfValidation', () => ({
  validatePDFFile: (...args: unknown[]) => mockValidatePDFFile(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import {
  formatFileSize,
  generatePDFHash,
  isValidHash,
  truncateHash,
} from '@/lib/pdfHash';

describe('pdfHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidatePDFFile.mockResolvedValue({ isValid: true });
    mockWordArrayCreate.mockImplementation((buffer: ArrayBuffer) => buffer);
    mockSha256ToString.mockReturnValue('abcd'.repeat(16));
    mockGetDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 4,
      }),
    });
  });

  function createMockFile(bytes: Uint8Array, name = 'test.pdf', type = 'application/pdf') {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return {
      name,
      size: bytes.byteLength,
      type,
      arrayBuffer: async () => buffer,
    } as unknown as File;
  }

  it('generates deterministic hash metadata for valid PDFs', async () => {
    const file = createMockFile(new Uint8Array([1, 2, 3, 4]));

    await expect(generatePDFHash(file)).resolves.toEqual({
      hash: `0x${'abcd'.repeat(16)}`,
      pageCount: 4,
      fileSize: 4,
      fileName: 'test.pdf',
    });

    expect(mockValidatePDFFile).toHaveBeenCalledWith(file);
    expect(mockWordArrayCreate).toHaveBeenCalled();
    expect(mockGetDocument).toHaveBeenCalledWith({
      data: await file.arrayBuffer(),
    });
  });

  it('rejects invalid PDFs using validation message', async () => {
    const file = createMockFile(new Uint8Array([1, 2, 3, 4]));
    mockValidatePDFFile.mockResolvedValue({
      isValid: false,
      message: 'Invalid PDF file',
    });

    await expect(generatePDFHash(file)).rejects.toThrow('Invalid PDF file');
    expect(mockGetDocument).not.toHaveBeenCalled();
  });

  it('surfaces pdf.js parsing failures with normalized message', async () => {
    const file = createMockFile(new Uint8Array([1, 2, 3, 4]));
    mockGetDocument.mockReturnValue({
      promise: Promise.reject(new Error('parse failed')),
    });

    await expect(generatePDFHash(file)).rejects.toThrow('Invalid PDF file. Unable to read document.');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('validates helper functions', () => {
    expect(isValidHash(`0x${'a'.repeat(64)}`)).toBe(true);
    expect(isValidHash('0x1234')).toBe(false);
    expect(formatFileSize(0)).toBe('0 Bytes');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(truncateHash('0x1234567890abcdef', 6, 4)).toBe('0x1234...cdef');
    expect(truncateHash('short', 6, 4)).toBe('short');
  });
});

import { describe, expect, it } from 'vitest';
import {
  getValidationErrorMessage,
  PDFValidationError,
  validatePDFFile,
} from '@/lib/pdfValidation';

function createFile(bytes: Uint8Array, type: string) {
  return {
    type,
    size: bytes.byteLength,
    slice: (start?: number, end?: number) => {
      const sliced = bytes.slice(start ?? 0, end ?? bytes.byteLength);
      return {
        arrayBuffer: async () => sliced.buffer.slice(sliced.byteOffset, sliced.byteOffset + sliced.byteLength),
      };
    },
  } as unknown as File;
}

describe('pdfValidation', () => {
  it('accepts valid PDF files', async () => {
    const payload = new Uint8Array(1024);
    payload.set([0x25, 0x50, 0x44, 0x46]);
    const file = createFile(payload, 'application/pdf');

    await expect(validatePDFFile(file)).resolves.toEqual({ isValid: true });
  });

  it('rejects invalid mime types', async () => {
    const file = createFile(new Uint8Array(2048), 'text/plain');

    await expect(validatePDFFile(file)).resolves.toMatchObject({
      isValid: false,
      error: PDFValidationError.INVALID_TYPE,
    });
  });

  it('rejects files that are too small', async () => {
    const payload = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const file = createFile(payload, 'application/pdf');

    await expect(validatePDFFile(file)).resolves.toMatchObject({
      isValid: false,
      error: PDFValidationError.FILE_TOO_SMALL,
    });
  });

  it('rejects files with invalid PDF signatures', async () => {
    const payload = new Uint8Array(1024);
    payload.set([0x00, 0x11, 0x22, 0x33]);
    const file = createFile(payload, 'application/pdf');

    await expect(validatePDFFile(file)).resolves.toMatchObject({
      isValid: false,
      error: PDFValidationError.INVALID_SIGNATURE,
    });
  });

  it('returns friendly messages for each validation error', () => {
    expect(getValidationErrorMessage(PDFValidationError.INVALID_TYPE)).toBe('Please upload a PDF file.');
    expect(getValidationErrorMessage(PDFValidationError.FILE_TOO_LARGE)).toContain('File is too large.');
    expect(getValidationErrorMessage(PDFValidationError.FILE_TOO_SMALL)).toBe('File is too small or empty.');
    expect(getValidationErrorMessage(PDFValidationError.INVALID_SIGNATURE)).toBe('File is not a valid PDF document.');
    expect(getValidationErrorMessage(PDFValidationError.CORRUPTED_FILE)).toBe('File appears to be corrupted.');
  });
});

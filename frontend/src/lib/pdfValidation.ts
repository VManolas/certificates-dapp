// frontend/src/lib/pdfValidation.ts

/**
 * PDF validation configuration
 */
export const PDF_VALIDATION_CONFIG = {
  // Maximum file size: 10 MB
  MAX_SIZE: 10 * 1024 * 1024,
  // Minimum file size: 1 KB (prevent empty files)
  MIN_SIZE: 1024,
  // Accepted MIME types
  ACCEPTED_MIME_TYPES: ['application/pdf'],
  // PDF magic bytes (signature)
  PDF_SIGNATURE: [0x25, 0x50, 0x44, 0x46], // %PDF
} as const;

/**
 * Validation error types
 */
export enum PDFValidationError {
  INVALID_TYPE = 'INVALID_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_TOO_SMALL = 'FILE_TOO_SMALL',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error?: PDFValidationError;
  message?: string;
}

/**
 * Validate PDF file type by MIME type
 */
function validateMimeType(file: File): ValidationResult {
  // Cast to string[] to allow includes() comparison with file.type
  const acceptedTypes: readonly string[] = PDF_VALIDATION_CONFIG.ACCEPTED_MIME_TYPES;
  if (!acceptedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: PDFValidationError.INVALID_TYPE,
      message: `Invalid file type: ${file.type}. Only PDF files are accepted.`,
    };
  }
  return { isValid: true };
}

/**
 * Validate PDF file size
 */
function validateFileSize(file: File): ValidationResult {
  if (file.size > PDF_VALIDATION_CONFIG.MAX_SIZE) {
    const maxMB = (PDF_VALIDATION_CONFIG.MAX_SIZE / (1024 * 1024)).toFixed(1);
    return {
      isValid: false,
      error: PDFValidationError.FILE_TOO_LARGE,
      message: `File size exceeds ${maxMB} MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
    };
  }

  if (file.size < PDF_VALIDATION_CONFIG.MIN_SIZE) {
    return {
      isValid: false,
      error: PDFValidationError.FILE_TOO_SMALL,
      message: 'File is too small or empty. Please upload a valid PDF document.',
    };
  }

  return { isValid: true };
}

/**
 * Validate PDF magic bytes (file signature)
 * Checks if the file starts with %PDF which is the PDF specification header
 */
async function validatePDFSignature(file: File): Promise<ValidationResult> {
  try {
    // Read first 4 bytes
    const blob = file.slice(0, 4);
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Check if matches PDF signature
    const isValidSignature = PDF_VALIDATION_CONFIG.PDF_SIGNATURE.every(
      (byte, index) => bytes[index] === byte
    );

    if (!isValidSignature) {
      return {
        isValid: false,
        error: PDFValidationError.INVALID_SIGNATURE,
        message: 'File does not appear to be a valid PDF. The file signature is incorrect.',
      };
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: PDFValidationError.CORRUPTED_FILE,
      message: 'Unable to read file. The file may be corrupted.',
    };
  }
}

/**
 * Comprehensive PDF validation
 * 
 * Performs multiple validation checks:
 * 1. MIME type validation
 * 2. File size validation (min/max)
 * 3. PDF signature validation (magic bytes)
 * 
 * @param file - The file to validate
 * @returns ValidationResult with detailed error information
 * 
 * @example
 * ```typescript
 * const result = await validatePDFFile(file);
 * if (!result.isValid) {
 *   console.error(result.message);
 *   return;
 * }
 * // Proceed with file processing
 * ```
 */
export async function validatePDFFile(file: File): Promise<ValidationResult> {
  // 1. Validate MIME type
  const mimeTypeResult = validateMimeType(file);
  if (!mimeTypeResult.isValid) {
    return mimeTypeResult;
  }

  // 2. Validate file size
  const sizeResult = validateFileSize(file);
  if (!sizeResult.isValid) {
    return sizeResult;
  }

  // 3. Validate PDF signature
  const signatureResult = await validatePDFSignature(file);
  if (!signatureResult.isValid) {
    return signatureResult;
  }

  return { isValid: true };
}

/**
 * Get user-friendly error message for validation errors
 */
export function getValidationErrorMessage(error: PDFValidationError): string {
  const messages: Record<PDFValidationError, string> = {
    [PDFValidationError.INVALID_TYPE]: 'Please upload a PDF file.',
    [PDFValidationError.FILE_TOO_LARGE]: `File is too large. Maximum size is ${(PDF_VALIDATION_CONFIG.MAX_SIZE / (1024 * 1024)).toFixed(0)} MB.`,
    [PDFValidationError.FILE_TOO_SMALL]: 'File is too small or empty.',
    [PDFValidationError.INVALID_SIGNATURE]: 'File is not a valid PDF document.',
    [PDFValidationError.CORRUPTED_FILE]: 'File appears to be corrupted.',
  };
  return messages[error];
}

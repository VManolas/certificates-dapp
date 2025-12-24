// src/lib/pdfHash.ts
import * as pdfjsLib from 'pdfjs-dist';
import CryptoJS from 'crypto-js';
import { validatePDFFile } from './pdfValidation';
import { logger } from './logger';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Result of PDF hash generation
 */
export interface HashResult {
  /** SHA-256 hash in bytes32 format (0x prefixed) */
  hash: `0x${string}`;
  /** Number of pages in the PDF */
  pageCount: number;
  /** File size in bytes */
  fileSize: number;
  /** Original filename */
  fileName: string;
}

/**
 * Generate SHA-256 hash from a PDF file
 * 
 * Uses raw binary hashing for consistency across platforms.
 * The hash is deterministic - same PDF will always produce same hash.
 * 
 * @param file - The PDF file to hash
 * @returns HashResult with hash and metadata
 * @throws Error if file is not a valid PDF
 */
export async function generatePDFHash(file: File): Promise<HashResult> {
  // Comprehensive validation (type, size, signature)
  const validationResult = await validatePDFFile(file);
  if (!validationResult.isValid) {
    throw new Error(validationResult.message || 'Invalid PDF file');
  }

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Hash the raw binary data for consistency
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer as unknown as number[]);
  const hash = CryptoJS.SHA256(wordArray).toString();

  // Get page count using PDF.js
  let pageCount = 0;
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    pageCount = pdf.numPages;
  } catch (error) {
    logger.error('Error reading PDF', error);
    throw new Error('Invalid PDF file. Unable to read document.');
  }

  return {
    hash: `0x${hash}` as `0x${string}`,
    pageCount,
    fileSize: file.size,
    fileName: file.name,
  };
}

/**
 * Validate if a string is a valid bytes32 hash
 * 
 * @param hash - The hash string to validate
 * @returns True if valid bytes32 format
 */
export function isValidHash(hash: string): hash is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Format file size for display
 * 
 * @param bytes - Size in bytes
 * @returns Human-readable size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Truncate hash for display
 * 
 * @param hash - Full hash string
 * @param startChars - Characters to show at start (default 6)
 * @param endChars - Characters to show at end (default 4)
 * @returns Truncated hash like "0x1234...abcd"
 */
export function truncateHash(
  hash: string,
  startChars = 6,
  endChars = 4
): string {
  if (hash.length <= startChars + endChars) return hash;
  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
}


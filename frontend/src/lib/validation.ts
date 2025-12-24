// src/lib/validation.ts
import { z } from 'zod';

/**
 * Runtime validation schemas for contract data
 * 
 * Ensures data returned from smart contracts matches expected structure
 * before processing to prevent runtime errors from malformed data.
 */

// Ethereum address schema
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

// Bytes32 hash schema
export const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid bytes32 hash');

/**
 * Certificate verification result schema
 */
export const certificateVerificationSchema = z.tuple([
  z.boolean(), // isValid
  z.bigint(),  // certificateId
  z.boolean(), // isRevoked
]);

export type CertificateVerificationTuple = z.infer<typeof certificateVerificationSchema>;

/**
 * Certificate details schema
 */
export const certificateDetailsSchema = z.object({
  documentHash: bytes32Schema,
  studentWallet: addressSchema,
  issuingInstitution: addressSchema,
  issueDate: z.bigint(),
  certificateId: z.bigint(),
  metadataURI: z.string(),
  isRevoked: z.boolean(),
  revokedAt: z.bigint(),
  revocationReason: z.string(),
});

export type CertificateDetails = z.infer<typeof certificateDetailsSchema>;

/**
 * Institution data schema
 */
export const institutionSchema = z.object({
  name: z.string(),
  emailDomain: z.string(),
  walletAddress: addressSchema,
  isVerified: z.boolean(),
  isActive: z.boolean(),
  verificationDate: z.bigint(),
  totalCertificatesIssued: z.bigint(),
});

export type Institution = z.infer<typeof institutionSchema>;

/**
 * Student certificates array schema
 */
export const studentCertificatesSchema = z.array(z.bigint());

/**
 * Hash exists result schema
 */
export const hashExistsSchema = z.boolean();

/**
 * Can issue certificates result schema
 */
export const canIssueCertificatesSchema = z.boolean();

/**
 * Role check result schema
 */
export const roleCheckSchema = z.boolean();

/**
 * Helper function to safely parse contract data
 */
export function safeParseContractData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  errorMessage = 'Invalid contract data'
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    console.error('Contract data validation failed:', result.error);
    throw new Error(`${errorMessage}: ${result.error.message}`);
  }
  
  return result.data;
}

/**
 * Helper to validate tuple data from contract
 */
export function validateTuple<T extends z.ZodTuple<any>>(
  schema: T,
  data: unknown
): z.infer<T> | null {
  if (!Array.isArray(data)) {
    console.error('Expected array/tuple, got:', typeof data);
    return null;
  }
  
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error('Tuple validation failed:', result.error);
    return null;
  }
  
  return result.data;
}

// src/lib/__tests__/validation.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addressSchema,
  bytes32Schema,
  canIssueCertificatesSchema,
  certificateDetailsSchema,
  certificateVerificationSchema,
  hashExistsSchema,
  institutionSchema,
  roleCheckSchema,
  safeParseContractData,
  studentCertificatesSchema,
  validateTuple,
} from '@/lib/validation';

const VALID_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const VALID_BYTES32 = '0x' + 'ab'.repeat(32);

describe('validation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── addressSchema ───────────────────────────────────────────────────────────

  describe('addressSchema', () => {
    it('accepts a valid checksummed address', () => {
      expect(addressSchema.safeParse(VALID_ADDRESS).success).toBe(true);
    });

    it('accepts a lowercase hex address', () => {
      expect(addressSchema.safeParse(VALID_ADDRESS.toLowerCase()).success).toBe(true);
    });

    it('accepts an uppercase hex address', () => {
      expect(addressSchema.safeParse('0x' + 'A'.repeat(40)).success).toBe(true);
    });

    it('rejects an address missing the 0x prefix', () => {
      expect(addressSchema.safeParse('f39Fd6e51aad88F6F4ce6aB8827279cffFb92266').success).toBe(false);
    });

    it('rejects an address that is too short', () => {
      expect(addressSchema.safeParse('0x1234abcd').success).toBe(false);
    });

    it('rejects an address that is too long', () => {
      expect(addressSchema.safeParse('0x' + 'a'.repeat(42)).success).toBe(false);
    });

    it('rejects an address with non-hex characters', () => {
      expect(addressSchema.safeParse('0x' + 'g'.repeat(40)).success).toBe(false);
    });

    it('rejects non-string inputs', () => {
      expect(addressSchema.safeParse(123).success).toBe(false);
      expect(addressSchema.safeParse(null).success).toBe(false);
      expect(addressSchema.safeParse(undefined).success).toBe(false);
    });
  });

  // ─── bytes32Schema ───────────────────────────────────────────────────────────

  describe('bytes32Schema', () => {
    it('accepts a valid 32-byte hex string', () => {
      expect(bytes32Schema.safeParse(VALID_BYTES32).success).toBe(true);
    });

    it('rejects a hash that is too short', () => {
      expect(bytes32Schema.safeParse('0x' + 'ab'.repeat(31)).success).toBe(false);
    });

    it('rejects a hash that is too long', () => {
      expect(bytes32Schema.safeParse('0x' + 'ab'.repeat(33)).success).toBe(false);
    });

    it('rejects a hash without 0x prefix', () => {
      expect(bytes32Schema.safeParse('ab'.repeat(32)).success).toBe(false);
    });

    it('rejects non-hex characters in hash', () => {
      expect(bytes32Schema.safeParse('0x' + 'zz'.repeat(32)).success).toBe(false);
    });
  });

  // ─── certificateVerificationSchema ──────────────────────────────────────────

  describe('certificateVerificationSchema', () => {
    it('accepts a valid [bool, bigint, bool] tuple', () => {
      expect(certificateVerificationSchema.safeParse([true, 1n, false]).success).toBe(true);
    });

    it('accepts all-false tuple with zero id', () => {
      expect(certificateVerificationSchema.safeParse([false, 0n, false]).success).toBe(true);
    });

    it('rejects a tuple where certificateId is a number, not bigint', () => {
      expect(certificateVerificationSchema.safeParse([true, 1, false]).success).toBe(false);
    });

    it('rejects a tuple that is too short', () => {
      expect(certificateVerificationSchema.safeParse([true, 1n]).success).toBe(false);
    });

    it('rejects a non-array', () => {
      expect(certificateVerificationSchema.safeParse({ isValid: true }).success).toBe(false);
    });
  });

  // ─── certificateDetailsSchema ────────────────────────────────────────────────

  describe('certificateDetailsSchema', () => {
    const validDetails = {
      documentHash: VALID_BYTES32,
      studentWallet: VALID_ADDRESS,
      issuingInstitution: VALID_ADDRESS,
      issueDate: 1000n,
      certificateId: 1n,
      metadataURI: 'ipfs://Qm...',
      isRevoked: false,
      revokedAt: 0n,
      revocationReason: '',
    };

    it('accepts a fully valid certificate details object', () => {
      expect(certificateDetailsSchema.safeParse(validDetails).success).toBe(true);
    });

    it('rejects an invalid address in studentWallet', () => {
      expect(certificateDetailsSchema.safeParse({ ...validDetails, studentWallet: '0xinvalid' }).success).toBe(false);
    });

    it('rejects an invalid hash in documentHash', () => {
      expect(certificateDetailsSchema.safeParse({ ...validDetails, documentHash: '0xshort' }).success).toBe(false);
    });

    it('rejects number instead of bigint for issueDate', () => {
      expect(certificateDetailsSchema.safeParse({ ...validDetails, issueDate: 1000 }).success).toBe(false);
    });

    it('rejects missing required field', () => {
      const { metadataURI: _removed, ...missing } = validDetails;
      expect(certificateDetailsSchema.safeParse(missing).success).toBe(false);
    });
  });

  // ─── institutionSchema ───────────────────────────────────────────────────────

  describe('institutionSchema', () => {
    const validInstitution = {
      name: 'Test University',
      emailDomain: 'test.edu',
      walletAddress: VALID_ADDRESS,
      isVerified: true,
      isActive: true,
      verificationDate: 1000n,
      totalCertificatesIssued: 42n,
    };

    it('accepts a fully valid institution object', () => {
      expect(institutionSchema.safeParse(validInstitution).success).toBe(true);
    });

    it('rejects an invalid walletAddress', () => {
      expect(institutionSchema.safeParse({ ...validInstitution, walletAddress: 'bad' }).success).toBe(false);
    });

    it('rejects number instead of bigint for counts', () => {
      expect(institutionSchema.safeParse({ ...validInstitution, totalCertificatesIssued: 42 }).success).toBe(false);
    });

    it('rejects a non-boolean for isVerified', () => {
      expect(institutionSchema.safeParse({ ...validInstitution, isVerified: 1 }).success).toBe(false);
    });
  });

  // ─── Simple boolean/array schemas ────────────────────────────────────────────

  describe('studentCertificatesSchema', () => {
    it('accepts an array of bigints', () => {
      expect(studentCertificatesSchema.safeParse([1n, 2n, 3n]).success).toBe(true);
    });

    it('accepts an empty array', () => {
      expect(studentCertificatesSchema.safeParse([]).success).toBe(true);
    });

    it('rejects an array containing numbers', () => {
      expect(studentCertificatesSchema.safeParse([1, 2]).success).toBe(false);
    });
  });

  describe('boolean schemas', () => {
    it('hashExistsSchema accepts true and false', () => {
      expect(hashExistsSchema.safeParse(true).success).toBe(true);
      expect(hashExistsSchema.safeParse(false).success).toBe(true);
    });

    it('hashExistsSchema rejects non-boolean', () => {
      expect(hashExistsSchema.safeParse(1).success).toBe(false);
    });

    it('canIssueCertificatesSchema accepts boolean', () => {
      expect(canIssueCertificatesSchema.safeParse(true).success).toBe(true);
    });

    it('roleCheckSchema accepts boolean', () => {
      expect(roleCheckSchema.safeParse(false).success).toBe(true);
    });
  });

  // ─── safeParseContractData ───────────────────────────────────────────────────

  describe('safeParseContractData', () => {
    it('returns parsed data when input is valid', () => {
      expect(safeParseContractData(addressSchema, VALID_ADDRESS)).toBe(VALID_ADDRESS);
    });

    it('throws with the default error prefix for invalid input', () => {
      expect(() => safeParseContractData(addressSchema, 'invalid')).toThrow('Invalid contract data');
    });

    it('uses a custom error message prefix when provided', () => {
      expect(() => safeParseContractData(addressSchema, 'bad', 'Custom msg')).toThrow('Custom msg');
    });

    it('logs console.error before throwing', () => {
      expect(() => safeParseContractData(addressSchema, 'bad')).toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'Contract data validation failed:',
        expect.anything(),
      );
    });

    it('parses bigint tuples correctly', () => {
      const result = safeParseContractData(certificateVerificationSchema, [true, 99n, false]);
      expect(result).toEqual([true, 99n, false]);
    });
  });

  // ─── validateTuple ───────────────────────────────────────────────────────────

  describe('validateTuple', () => {
    it('returns null for a non-array string input', () => {
      expect(validateTuple(certificateVerificationSchema, 'not-an-array')).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('returns null for a non-array object', () => {
      expect(validateTuple(certificateVerificationSchema, {})).toBeNull();
    });

    it('returns null for null input', () => {
      expect(validateTuple(certificateVerificationSchema, null)).toBeNull();
    });

    it('returns null when array elements have wrong types', () => {
      expect(validateTuple(certificateVerificationSchema, [true, 'not-bigint', false])).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('returns parsed data for a valid tuple', () => {
      const result = validateTuple(certificateVerificationSchema, [true, 42n, false]);
      expect(result).toEqual([true, 42n, false]);
    });

    it('returns null for a tuple of wrong length', () => {
      expect(validateTuple(certificateVerificationSchema, [true, 1n])).toBeNull();
    });
  });
});

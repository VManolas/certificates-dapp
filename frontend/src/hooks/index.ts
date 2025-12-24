/**
 * Frontend Hooks - Contract Interaction
 * 
 * This module exports all custom hooks for interacting with the smart contracts.
 * These hooks provide a clean, type-safe interface for:
 * - Certificate issuance and verification
 * - Institution registration and management
 * - Contract version checking
 * - User role detection and management
 * - Helper functions for improved DX and gas efficiency
 */

// Certificate Issuance
export {
  useCertificateIssuance,
  useCertificateIssuanceWithCallback,
  useCertificateIssuanceWithDuplicateCheck,
  type IssueCertificateParams,
  type UseCertificateIssuanceReturn,
} from './useCertificateIssuance';

// Certificate Verification
export {
  useCertificateVerification,
  useCertificateDetails,
  useCertificateByHash,
  useStudentCertificates,
  useCertificateExists,
  useHashExists,
  useCertificatesBatch,
  type CertificateVerificationResult,
  type UseCertificateVerificationReturn,
  type CertificateDetails,
  type UseCertificateDetailsReturn,
  type BatchCertificatesResult,
} from './useCertificateVerification';

// Institution Registry (Admin Functions)
export {
  useRegisterUniversity,
  useIsInstitution,
  useApproveInstitution,
  useDeactivateInstitution,
} from './useInstitutionRegistry';

// Contract Versioning
export {
  useCertificateRegistryVersion,
  useInstitutionRegistryVersion,
  useCertificateRegistryUpgradeHistory,
  useInstitutionRegistryUpgradeHistory,
  useContractVersions,
} from './useContractVersion';

// User Role Detection
export {
  useUserRoles,
  type DetectedRoles,
} from './useUserRoles';

// Certificate Revocation
export {
  useCertificateRevocation,
} from './useCertificateRevocation';

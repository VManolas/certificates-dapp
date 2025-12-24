// frontend/src/hooks/useUserRoles.ts
import { useAccount, useReadContracts } from 'wagmi';
import { useMemo } from 'react';
import { keccak256, toBytes } from 'viem';
import InstitutionRegistryABI from '@/contracts/abis/InstitutionRegistry.json';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import EmployerRegistryABI from '@/contracts/abis/EmployerRegistry.json';

// Role type as defined in authStore
export type UserRole = 'university' | 'student' | 'employer' | 'admin' | null;

// Computed role constant for contract queries
const SUPER_ADMIN_ROLE = keccak256(toBytes('SUPER_ADMIN_ROLE'));

// Contract addresses - these should match your deployed contracts
const INSTITUTION_REGISTRY_ADDRESS = import.meta.env.VITE_INSTITUTION_REGISTRY_ADDRESS as `0x${string}`;
const CERTIFICATE_REGISTRY_ADDRESS = import.meta.env.VITE_CERTIFICATE_REGISTRY_ADDRESS as `0x${string}`;
const EMPLOYER_REGISTRY_ADDRESS = import.meta.env.VITE_EMPLOYER_REGISTRY_ADDRESS as `0x${string}`;

export interface DetectedRoles {
  isAdmin: boolean;
  isUniversity: boolean;
  isVerifiedUniversity: boolean;
  universityData: {
    name: string;
    emailDomain: string;
    isVerified: boolean;
    isActive: boolean;
    verificationDate: bigint;
    totalCertificatesIssued: bigint;
  } | null;
  isStudent: boolean;
  studentCertificateCount: number;
  isEmployer: boolean;
  primaryRole: UserRole;
  availableRoles: UserRole[];
  canRegisterAsEmployer: boolean;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to detect all roles for the connected wallet
 * 
 * Enforces strict user hierarchy:
 * 1. Admin - Can only be admin (set in contract)
 * 2. University - Can only be university (registered by admin)
 * 3. Student - Can ONLY be student (has certificates), CANNOT be employer
 * 4. Employer - Must register with company details (if not admin/university/student)
 * 
 * Queries multiple contracts in parallel to determine:
 * - Admin status (SUPER_ADMIN_ROLE)
 * - University registration and verification status
 * - Student certificate ownership
 * - Employer registration status
 * 
 * @example
 * ```tsx
 * const { primaryRole, availableRoles, canRegisterAsEmployer, isLoading } = useUserRoles();
 * 
 * if (canRegisterAsEmployer) {
 *   // Show employer registration
 * }
 * ```
 */
export function useUserRoles(): DetectedRoles {
  const { address, isConnected } = useAccount();

  // Batch contract reads for efficiency
  const { data, isLoading, error, refetch } = useReadContracts({
    contracts: [
      // Check admin role in InstitutionRegistry
      {
        address: INSTITUTION_REGISTRY_ADDRESS,
        abi: InstitutionRegistryABI.abi,
        functionName: 'hasRole',
        args: [SUPER_ADMIN_ROLE, address],
      },
      // Check admin role in CertificateRegistry (backup check)
      {
        address: CERTIFICATE_REGISTRY_ADDRESS,
        abi: CertificateRegistryABI.abi,
        functionName: 'hasRole',
        args: [SUPER_ADMIN_ROLE, address],
      },
      // Get institution data
      {
        address: INSTITUTION_REGISTRY_ADDRESS,
        abi: InstitutionRegistryABI.abi,
        functionName: 'getInstitution',
        args: [address],
      },
      // Get student certificates
      {
        address: CERTIFICATE_REGISTRY_ADDRESS,
        abi: CertificateRegistryABI.abi,
        functionName: 'getCertificatesByStudent',
        args: [address],
      },
      // Check employer registration
      {
        address: EMPLOYER_REGISTRY_ADDRESS,
        abi: EmployerRegistryABI.abi,
        functionName: 'isEmployer',
        args: [address],
      },
    ],
    query: {
      enabled: isConnected && !!address,
    },
  });

  return useMemo(() => {
    if (!data || !isConnected) {
      return {
        isAdmin: false,
        isUniversity: false,
        isVerifiedUniversity: false,
        universityData: null,
        isStudent: false,
        studentCertificateCount: 0,
        isEmployer: false,
        primaryRole: null,
        availableRoles: [],
        canRegisterAsEmployer: false,
        isLoading,
        error: error as Error | null,
        refetch,
      };
    }

    // Parse results
    const isAdminInstitution = data[0]?.result as boolean ?? false;
    const isAdminCertificate = data[1]?.result as boolean ?? false;
    const isAdmin = isAdminInstitution || isAdminCertificate;

    // Institution data parsing
    const institutionResult = data[2]?.result as any;
    const isUniversity = institutionResult?.walletAddress !== '0x0000000000000000000000000000000000000000' 
                        && institutionResult?.walletAddress !== undefined
                        && institutionResult?.name !== '';
    
    const universityData = isUniversity ? {
      name: institutionResult.name,
      emailDomain: institutionResult.emailDomain,
      isVerified: institutionResult.isVerified,
      isActive: institutionResult.isActive,
      verificationDate: institutionResult.verificationDate,
      totalCertificatesIssued: institutionResult.totalCertificatesIssued,
    } : null;

    const isVerifiedUniversity = isUniversity && institutionResult.isVerified && institutionResult.isActive;

    // Student certificates
    const certificates = data[3]?.result as bigint[] ?? [];
    const isStudent = certificates.length > 0;
    const studentCertificateCount = certificates.length;

    // Employer registration
    const isEmployer = data[4]?.result as boolean ?? false;

    // ============================================
    // Enforce User Hierarchy
    // ============================================
    // Priority Order: Admin > University > Student > Employer
    
    let primaryRole: UserRole = null;
    const availableRoles: UserRole[] = [];
    let canRegisterAsEmployer = false;

    if (isAdmin) {
      // ADMIN: Can ONLY be admin
      primaryRole = 'admin';
      availableRoles.push('admin');
      canRegisterAsEmployer = false;
    } else if (isUniversity) {
      // UNIVERSITY: Can ONLY be university
      primaryRole = 'university';
      availableRoles.push('university');
      canRegisterAsEmployer = false;
    } else if (isStudent) {
      // STUDENT: Can ONLY be student, CANNOT be employer
      primaryRole = 'student';
      availableRoles.push('student');
      canRegisterAsEmployer = false;
    } else if (isEmployer) {
      // EMPLOYER: Registered employer
      primaryRole = 'employer';
      availableRoles.push('employer');
      canRegisterAsEmployer = false; // Already registered
    } else {
      // NEW USER: Can register as employer
      primaryRole = null;
      canRegisterAsEmployer = true;
    }

    return {
      isAdmin,
      isUniversity,
      isVerifiedUniversity,
      universityData,
      isStudent,
      studentCertificateCount,
      isEmployer,
      primaryRole,
      availableRoles,
      canRegisterAsEmployer,
      isLoading,
      error: error as Error | null,
      refetch,
    };
  }, [data, isConnected, isLoading, error, refetch]);
}


/**
 * @fileoverview React hooks for interacting with the EmployerRegistry contract
 * @module hooks/useEmployerRegistry
 */

import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Address } from 'viem';
import EmployerRegistryABI from '@/contracts/abis/EmployerRegistry.json';
import type { Employer, EmployerRegistrationStatus } from '@/types/employer';

const EMPLOYER_REGISTRY_ADDRESS = import.meta.env.VITE_EMPLOYER_REGISTRY_ADDRESS as Address;

/**
 * Hook to check if an address is a registered and active employer
 */
export function useIsEmployer(address?: Address) {
  const { data: isEmployer, isLoading, refetch } = useReadContract({
    address: EMPLOYER_REGISTRY_ADDRESS,
    abi: EmployerRegistryABI.abi,
    functionName: 'isEmployer',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!EMPLOYER_REGISTRY_ADDRESS,
    },
  });

  return {
    isEmployer: isEmployer as boolean | undefined,
    isLoading,
    refetch,
  };
}

/**
 * Hook to get employer information
 */
export function useEmployerInfo(address?: Address) {
  const { data: employerData, isLoading, isError, refetch } = useReadContract({
    address: EMPLOYER_REGISTRY_ADDRESS,
    abi: EmployerRegistryABI.abi,
    functionName: 'getEmployer',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!EMPLOYER_REGISTRY_ADDRESS,
    },
  });

  const employer = employerData as Employer | undefined;

  return {
    employer,
    isLoading,
    isError,
    refetch,
  };
}

/**
 * Hook for employer registration
 */
export function useEmployerRegistration() {
  const { address } = useAccount();
  const [status, setStatus] = useState<EmployerRegistrationStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Check if already registered
  const { isEmployer, isLoading: isCheckingRegistration } = useIsEmployer(address);

  // Write contract hook
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Update status based on registration check
  useEffect(() => {
    if (isCheckingRegistration) {
      setStatus('checking');
    } else if (isEmployer) {
      setStatus('registered');
    } else if (!isCheckingRegistration && isEmployer === false) {
      setStatus('not_registered');
    }
  }, [isCheckingRegistration, isEmployer]);

  // Update status during registration
  useEffect(() => {
    if (isWritePending || isConfirming) {
      setStatus('registering');
      setError(null);
    } else if (isConfirmed) {
      setStatus('registered');
      setError(null);
    } else if (writeError) {
      setStatus('error');
      setError(writeError.message || 'Registration failed');
    }
  }, [isWritePending, isConfirming, isConfirmed, writeError]);

  const registerEmployer = async (companyName: string, vatNumber: string) => {
    if (!address) {
      setError('Wallet not connected');
      setStatus('error');
      return;
    }

    if (!EMPLOYER_REGISTRY_ADDRESS) {
      setError('Employer Registry contract not configured');
      setStatus('error');
      return;
    }

    try {
      setStatus('registering');
      setError(null);

      writeContract({
        address: EMPLOYER_REGISTRY_ADDRESS,
        abi: EmployerRegistryABI.abi,
        functionName: 'registerEmployer',
        args: [companyName, vatNumber],
      });
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setStatus('error');
    }
  };

  const updateEmployer = async (companyName: string, vatNumber: string) => {
    if (!address) {
      setError('Wallet not connected');
      setStatus('error');
      return;
    }

    if (!EMPLOYER_REGISTRY_ADDRESS) {
      setError('Employer Registry contract not configured');
      setStatus('error');
      return;
    }

    try {
      setError(null);

      writeContract({
        address: EMPLOYER_REGISTRY_ADDRESS,
        abi: EmployerRegistryABI.abi,
        functionName: 'updateEmployer',
        args: [companyName, vatNumber],
      });
    } catch (err) {
      console.error('Update error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setStatus('error');
    }
  };

  return {
    registerEmployer,
    updateEmployer,
    status,
    error,
    isRegistering: status === 'registering',
    isRegistered: status === 'registered',
    isChecking: status === 'checking',
    transactionHash: hash,
  };
}

/**
 * Hook to get total number of employers
 */
export function useTotalEmployers() {
  const { data: totalEmployers, isLoading, refetch } = useReadContract({
    address: EMPLOYER_REGISTRY_ADDRESS,
    abi: EmployerRegistryABI.abi,
    functionName: 'totalEmployers',
    query: {
      enabled: !!EMPLOYER_REGISTRY_ADDRESS,
    },
  });

  return {
    totalEmployers: totalEmployers as bigint | undefined,
    isLoading,
    refetch,
  };
}


/**
 * @fileoverview React hooks for interacting with the InstitutionRegistry contract
 * @module hooks/useInstitutionRegistry
 */

import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { Address } from 'viem';
import { useEffect, useRef, useState } from 'react';
import InstitutionRegistryABI from '@/contracts/abis/InstitutionRegistry.json';

const INSTITUTION_REGISTRY_ADDRESS = import.meta.env.VITE_INSTITUTION_REGISTRY_ADDRESS as Address;
type TransactionPhase = 'idle' | 'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed' | 'failed';
const MIN_PENDING_DISPLAY_MS = 1200;

/**
 * Hook for admin to register a new university directly (admin-initiated)
 */
export function useRegisterInstitutionByAdmin() {
  const {
    data: hash,
    writeContractAsync,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const {
    isSuccess: isConfirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash,
  });
  const [transactionPhase, setTransactionPhase] = useState<TransactionPhase>('idle');
  const pendingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (writeError || receiptError) {
      setTransactionPhase('failed');
      return;
    }

    if (isWritePending && !hash) {
      setTransactionPhase('awaiting_wallet_confirmation');
      pendingStartRef.current = null;
      return;
    }

    if (hash && !isConfirmed) {
      if (pendingStartRef.current === null) {
        pendingStartRef.current = Date.now();
      }
      setTransactionPhase('pending_onchain');
      return;
    }

    if (isConfirmed && hash) {
      const pendingSince = pendingStartRef.current ?? Date.now();
      const elapsed = Date.now() - pendingSince;
      const waitRemaining = Math.max(0, MIN_PENDING_DISPLAY_MS - elapsed);
      const timer = setTimeout(() => setTransactionPhase('confirmed'), waitRemaining);
      return () => clearTimeout(timer);
    }

    setTransactionPhase('idle');
    pendingStartRef.current = null;
  }, [isWritePending, hash, isConfirmed, writeError, receiptError]);

  const isAwaitingWalletConfirmation = transactionPhase === 'awaiting_wallet_confirmation';
  const isPendingOnchain = transactionPhase === 'pending_onchain';

  const registerInstitutionByAdmin = async (walletAddress: Address, name: string, emailDomain: string) => {
    if (!INSTITUTION_REGISTRY_ADDRESS) {
      throw new Error('Institution Registry contract not configured');
    }

    try {
      await writeContractAsync({
        address: INSTITUTION_REGISTRY_ADDRESS,
        abi: InstitutionRegistryABI.abi,
        functionName: 'registerInstitutionByAdmin',
        args: [walletAddress, name, emailDomain],
      });
    } catch (err) {
      console.error('Admin registration error:', err);
      throw err;
    }
  };

  return {
    registerInstitutionByAdmin,
    isRegistering: isAwaitingWalletConfirmation || isPendingOnchain,
    isSuccess: transactionPhase === 'confirmed',
    error: writeError ?? receiptError,
    transactionHash: hash,
    transactionPhase,
    isAwaitingWalletConfirmation,
    isPendingOnchain,
  };
}

/**
 * Hook for university to self-register (requires admin approval)
 */
export function useRegisterUniversity() {
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const registerUniversity = async (name: string, emailDomain: string) => {
    if (!INSTITUTION_REGISTRY_ADDRESS) {
      throw new Error('Institution Registry contract not configured');
    }

    try {
      writeContract({
        address: INSTITUTION_REGISTRY_ADDRESS,
        abi: InstitutionRegistryABI.abi,
        functionName: 'registerInstitution',
        args: [name, emailDomain],
      });
    } catch (err) {
      console.error('Registration error:', err);
      throw err;
    }
  };

  return {
    registerUniversity,
    isRegistering: isWritePending || isConfirming,
    isSuccess: isConfirmed,
    error: writeError,
    transactionHash: hash,
  };
}

/**
 * Hook to check if an address is already registered as an institution
 */
export function useIsInstitution(address?: Address) {
  const { data, isLoading, refetch } = useReadContract({
    address: INSTITUTION_REGISTRY_ADDRESS,
    abi: InstitutionRegistryABI.abi,
    functionName: 'getInstitution',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!INSTITUTION_REGISTRY_ADDRESS,
    },
  });

  // Check if the returned data indicates a registered institution
  const institutionData = data as any;
  const isRegistered = institutionData?.walletAddress !== '0x0000000000000000000000000000000000000000' 
                       && institutionData?.walletAddress !== undefined
                       && institutionData?.name !== '';

  return {
    isRegistered,
    institutionData,
    isLoading,
    refetch,
  };
}

/**
 * Hook for admin to approve an institution
 */
export function useApproveInstitution() {
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const approveInstitution = async (institutionAddress: Address) => {
    if (!INSTITUTION_REGISTRY_ADDRESS) {
      throw new Error('Institution Registry contract not configured');
    }

    try {
      writeContract({
        address: INSTITUTION_REGISTRY_ADDRESS,
        abi: InstitutionRegistryABI.abi,
        functionName: 'approveInstitution',
        args: [institutionAddress],
      });
    } catch (err) {
      console.error('Approval error:', err);
      throw err;
    }
  };

  return {
    approveInstitution,
    isApproving: isWritePending || isConfirming,
    isSuccess: isConfirmed,
    error: writeError,
    transactionHash: hash,
  };
}

/**
 * Hook for admin to deactivate an institution
 */
export function useDeactivateInstitution() {
  const {
    data: hash,
    writeContract,
    isPending: isWritePending,
    error: writeError,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const deactivateInstitution = async (institutionAddress: Address) => {
    if (!INSTITUTION_REGISTRY_ADDRESS) {
      throw new Error('Institution Registry contract not configured');
    }

    try {
      writeContract({
        address: INSTITUTION_REGISTRY_ADDRESS,
        abi: InstitutionRegistryABI.abi,
        functionName: 'deactivateInstitution',
        args: [institutionAddress],
      });
    } catch (err) {
      console.error('Deactivation error:', err);
      throw err;
    }
  };

  return {
    deactivateInstitution,
    isDeactivating: isWritePending || isConfirming,
    isSuccess: isConfirmed,
    error: writeError,
    transactionHash: hash,
  };
}

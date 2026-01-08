// frontend/src/hooks/useZKAuth.ts
/**
 * ZK Authentication Hook for zkCredentials
 * =========================================
 * 
 * Provides privacy-preserving authentication functionality:
 * - Register with commitment (wallet address hidden)
 * - Login with ZK proof (proves knowledge without revealing secrets)
 * - Session management
 * - Role assignment
 * 
 * Usage:
 * ```tsx
 * const { register, login, logout, isAuthenticated, role, isLoading } = useZKAuth();
 * 
 * // Register new user
 * await register('student');
 * 
 * // Login with ZK proof
 * await login();
 * 
 * // Check authentication
 * if (isAuthenticated && role === 'student') {
 *   // Show student dashboard
 * }
 * ```
 */

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ethers } from 'ethers';
import { 
  generateRandomKey, 
  computeCommitment,
  encryptCredentials,
  decryptCredentials,
  storeCredentials,
  getStoredCredentials,
  clearStoredCredentials,
  hasStoredCredentials,
} from '@/lib/zkAuth';
import ZKAuthRegistryABI from '@/contracts/abis/ZKAuthRegistry.json';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/store/authStore';

// Contract address (will be set after deployment)
const ZK_AUTH_REGISTRY_ADDRESS = import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS as `0x${string}` | undefined;

// UserRole type includes all roles, but ZK auth only supports student and employer
export type UserRole = 'student' | 'university' | 'employer' | 'admin' | null;
export type ZKAuthRole = 'student' | 'employer'; // Only these roles can use ZK authentication

interface ZKAuthState {
  isAuthenticated: boolean;
  role: UserRole;
  commitment: string | null;
  sessionId: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useZKAuth() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: txHash, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { 
    setZKAuthEnabled, 
    setZKCommitment, 
    setZKSessionId, 
    setZKAuthenticated,
    setZKRole,
    zkAuth 
  } = useAuthStore();
  
  const [state, setState] = useState<ZKAuthState>({
    isAuthenticated: zkAuth.isZKAuthenticated,
    role: zkAuth.zkRole,
    commitment: zkAuth.zkCommitment,
    sessionId: zkAuth.zkSessionId,
    isLoading: false,
    error: null,
  });

  // Sync state with auth store
  useEffect(() => {
    setState(s => ({
      ...s,
      isAuthenticated: zkAuth.isZKAuthenticated,
      role: zkAuth.zkRole,
      commitment: zkAuth.zkCommitment,
      sessionId: zkAuth.zkSessionId,
    }));
  }, [zkAuth]);

  /**
   * Register new user with commitment
   * 
   * @param role User role (student or employer only - universities and admins use Web3 auth)
   * @returns Commitment hash
   */
  const register = useCallback(async (role: ZKAuthRole) => {
    if (!address || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!ZK_AUTH_REGISTRY_ADDRESS) {
      throw new Error('ZK Auth Registry not configured');
    }

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      logger.info('Generating ZK credentials for registration', { role });

      // Step 1: Generate keypair and salt locally
      const privateKey = generateRandomKey();
      const salt = generateRandomKey();

      // Step 2: Compute commitment
      const commitment = await computeCommitment(privateKey, address, salt);

      logger.debug('Commitment computed', { commitment });

      // Step 3: Generate ZK proof using Noir circuit
      logger.info('🔐 Generating secure authentication proof...');
      const { generateAuthProof } = await import('@/lib/zkAuth');
      const proof = await generateAuthProof(
        { privateKey, salt, commitment, role },
        address
      );

      logger.debug('Authentication proof generated for registration');

      // Step 4: Encrypt and store credentials locally
      // Request signature for encryption
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      const message = 'Sign this message to encrypt your zkAuth credentials.\n\nThis signature is used locally and never leaves your device.';
      const signature = await signer.signMessage(message);

      const encrypted = await encryptCredentials(
        { privateKey, salt, commitment, role },
        signature
      );

      storeCredentials(encrypted);

      logger.info('Credentials encrypted and stored');

      // Step 5: Register commitment on-chain
      // Map role to enum: None=0, Student=1, Employer=2
      const roleEnum = 
        role === 'student' ? 1 : 
        role === 'employer' ? 2 : 
        1; // Default to student if unknown

      writeContract({
        address: ZK_AUTH_REGISTRY_ADDRESS,
        abi: ZKAuthRegistryABI.abi,
        functionName: 'registerCommitment',
        args: [commitment, roleEnum, proof],
      });

      setState(s => ({ ...s, commitment }));
      
      // Update auth store
      setZKCommitment(commitment);
      setZKRole(role);

      return commitment;
    } catch (error) {
      logger.error('Registration failed', error);
      setState(s => ({ ...s, isLoading: false, error: error as Error }));
      throw error;
    }
  }, [address, isConnected, writeContract]);

  /**
   * Login with ZK proof
   * 
   * IMPORTANT: This function requests account access ONLY for signing (to decrypt credentials).
   * It does NOT require a persistent "wallet connection" - just momentary access to sign.
   * 
   * Flow:
   * 1. Request accounts via eth_requestAccounts (prompts user to approve access)
   * 2. Sign message to decrypt stored credentials (local operation)
   * 3. Generate ZK proof (local operation)
   * 4. Submit session start transaction (on-chain operation)
   * 
   * @returns Session ID (set via transaction confirmation)
   */
  const login = useCallback(async () => {
    if (!ZK_AUTH_REGISTRY_ADDRESS) {
      throw new Error('ZK Auth Registry not configured');
    }

    if (!hasStoredCredentials()) {
      throw new Error('No stored credentials. Please register first.');
    }

    if (!window.ethereum) {
      throw new Error('MetaMask or compatible wallet not found');
    }

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      logger.info('Starting ZK login - requesting account access for signing only...');

      // Step 1: Request account access (prompts user approval if not already granted)
      // This is needed to get a signer for the signature request
      let accounts: string[];
      try {
        accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        }) as string[];
      } catch (err) {
        // User rejected the request
        throw new Error('Please approve wallet access to decrypt your credentials');
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.');
      }

      logger.info(`Account access granted: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`);

      // Step 2: Decrypt stored credentials using wallet signature
      const encrypted = getStoredCredentials()!;
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      const message = 'Sign this message to decrypt your zkAuth credentials.\n\nThis signature is used locally and never leaves your device.';
      
      let signature: string;
      try {
        signature = await signer.signMessage(message);
      } catch (err) {
        throw new Error('Signature required to decrypt credentials. Please approve the signature request.');
      }

      const credentials = await decryptCredentials(encrypted, signature);
      logger.debug('Credentials decrypted successfully');

      // Restore role from credentials to auth store
      setZKRole(credentials.role);
      logger.debug(`Role restored from credentials: ${credentials.role}`);

      // Step 3: Generate login proof using Noir circuit
      logger.info('🔐 Generating secure authentication proof...');
      const { generateAuthProof } = await import('@/lib/zkAuth');
      const proof = await generateAuthProof(credentials, accounts[0]);
      logger.debug('Authentication proof generated for login');

      // Step 4: Start session on-chain
      writeContract({
        address: ZK_AUTH_REGISTRY_ADDRESS,
        abi: ZKAuthRegistryABI.abi,
        functionName: 'startSession',
        args: [credentials.commitment, proof],
      });

      setState(s => ({ ...s, commitment: credentials.commitment }));
      
      // NOTE: Transaction submitted, but not confirmed yet
      // The transaction confirmation will be handled by the useEffect below
      logger.info('Session creation transaction submitted, waiting for confirmation...');
    } catch (error) {
      const err = error as Error;
      
      // Handle outdated credentials silently - this is expected after updates
      if (err.message === 'CREDENTIALS_OUTDATED') {
        logger.info('ℹ️ Stored credentials are outdated. Please register again with the new version.');
        setState(s => ({ ...s, isLoading: false }));
        // Don't set error state - just let the user know they need to register again
        return;
      }
      
      logger.error('Login failed', error);
      setState(s => ({ ...s, isLoading: false, error: err }));
      throw error;
    }
  }, [writeContract]);

  /**
   * Logout (end session)
   */
  const logout = useCallback(async () => {
    if (!state.sessionId || !ZK_AUTH_REGISTRY_ADDRESS) {
      // Just clear local state
      setState({
        isAuthenticated: false,
        role: null,
        commitment: null,
        sessionId: null,
        isLoading: false,
        error: null,
      });
      
      // Update auth store
      setZKAuthenticated(false);
      setZKSessionId(null);
      
      return;
    }

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      logger.info('Logging out', { sessionId: state.sessionId });

      // End session on-chain
      writeContract({
        address: ZK_AUTH_REGISTRY_ADDRESS,
        abi: ZKAuthRegistryABI.abi,
        functionName: 'endSession',
        args: [state.sessionId],
      });

      // Clear local state immediately (optimistic)
      setState({
        isAuthenticated: false,
        role: null,
        commitment: null,
        sessionId: null,
        isLoading: false,
        error: null,
      });
      
      // Update auth store
      setZKAuthenticated(false);
      setZKSessionId(null);

      logger.info('Logged out successfully');
    } catch (error) {
      logger.error('Logout failed', error);
      setState(s => ({ ...s, isLoading: false, error: error as Error }));
    }
  }, [state.sessionId, writeContract]);

  /**
   * Clear stored credentials (for testing)
   */
  const clearCredentials = useCallback(() => {
    clearStoredCredentials();
    setState({
      isAuthenticated: false,
      role: null,
      commitment: null,
      sessionId: null,
      isLoading: false,
      error: null,
    });
    
    // Update auth store
    setZKAuthEnabled(false);
    setZKCommitment(null);
    setZKSessionId(null);
    setZKAuthenticated(false);
    setZKRole(null);
    
    logger.info('Credentials cleared');
  }, [setZKAuthEnabled, setZKCommitment, setZKSessionId, setZKAuthenticated, setZKRole]);

  // Handle transaction success
  useEffect(() => {
    logger.debug('Transaction status check', { 
      txSuccess, 
      isLoading: state.isLoading, 
      hasCommitment: !!state.commitment,
      txHash 
    });
    
    if (txSuccess && !state.isLoading) {
      setState(s => ({ ...s, isLoading: false }));
      
      // Enable ZK auth in store when tx succeeds
      if (state.commitment) {
        logger.info('✅ Setting ZK authentication state', {
          commitment: state.commitment,
          txHash
        });
        setZKAuthEnabled(true);
        setZKAuthenticated(true);
        setZKSessionId(txHash || null);
        logger.info('✅ ZK authentication successful - transaction confirmed');
      } else {
        logger.warn('⚠️ Transaction succeeded but no commitment found in state');
      }
    }
  }, [txSuccess, state.isLoading, state.commitment, txHash, setZKAuthEnabled, setZKAuthenticated, setZKSessionId]);

  // Handle transaction errors
  useEffect(() => {
    if (writeError) {
      setState(s => ({ ...s, isLoading: false, error: writeError as Error }));
    }
  }, [writeError]);

  return {
    // State
    isAuthenticated: state.isAuthenticated,
    role: state.role,
    commitment: state.commitment,
    sessionId: state.sessionId,
    isLoading: state.isLoading || isWriting || isConfirming,
    error: state.error || writeError,
    hasCredentials: hasStoredCredentials(),
    
    // Actions
    register,
    login,
    logout,
    clearCredentials,
  };
}


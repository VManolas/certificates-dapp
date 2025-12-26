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
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { ethers } from 'ethers';
import { 
  generateRandomKey, 
  computeCommitment,
  encryptCredentials,
  decryptCredentials,
  generateAuthProof,
  storeCredentials,
  getStoredCredentials,
  clearStoredCredentials,
  hasStoredCredentials,
  type ZKCredentials 
} from '@/lib/zkAuth';
import ZKAuthRegistryABI from '@/contracts/abis/ZKAuthRegistry.json';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/store/authStore';

// Contract address (will be set after deployment)
const ZK_AUTH_REGISTRY_ADDRESS = import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS as `0x${string}` | undefined;

export type UserRole = 'student' | 'university' | 'employer' | 'admin' | null;

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
   * @param role User role (student, university, employer)
   * @returns Commitment hash
   */
  const register = useCallback(async (role: 'student' | 'university' | 'employer') => {
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

      // Step 3: Generate ZK proof
      const proof = await generateAuthProof({ privateKey, salt, commitment });

      logger.debug('ZK proof generated');

      // Step 4: Encrypt and store credentials locally
      // Request signature for encryption
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const message = 'Sign this message to encrypt your zkAuth credentials.\n\nThis signature is used locally and never leaves your device.';
      const signature = await signer.signMessage(message);

      const encrypted = await encryptCredentials(
        { privateKey, salt, commitment },
        signature
      );

      storeCredentials(encrypted);

      logger.info('Credentials encrypted and stored');

      // Step 5: Register commitment on-chain
      // Map role to enum: None=0, Student=1, University=2, Employer=3, Admin=4
      const roleEnum = 
        role === 'student' ? 1 : 
        role === 'university' ? 2 : 
        role === 'employer' ? 3 : 
        role === 'admin' ? 4 : 1; // Default to student if unknown

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
   * @returns Session ID
   */
  const login = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!ZK_AUTH_REGISTRY_ADDRESS) {
      throw new Error('ZK Auth Registry not configured');
    }

    if (!hasStoredCredentials()) {
      throw new Error('No stored credentials. Please register first.');
    }

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      logger.info('Starting ZK login');

      // Step 1: Decrypt stored credentials
      const encrypted = getStoredCredentials()!;
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const message = 'Sign this message to decrypt your zkAuth credentials.\n\nThis signature is used locally and never leaves your device.';
      const signature = await signer.signMessage(message);

      const credentials = await decryptCredentials(encrypted, signature);

      logger.debug('Credentials decrypted');

      // Step 2: Generate login proof
      const proof = await generateAuthProof(credentials);

      logger.debug('Login proof generated');

      // Step 3: Start session on-chain
      writeContract({
        address: ZK_AUTH_REGISTRY_ADDRESS,
        abi: ZKAuthRegistryABI.abi,
        functionName: 'startSession',
        args: [credentials.commitment, proof],
      });

      setState(s => ({ ...s, commitment: credentials.commitment }));
      
      // Update auth store
      setZKSessionId(txHash || null);
      setZKAuthenticated(true);

      logger.info('Session creation transaction submitted');
    } catch (error) {
      logger.error('Login failed', error);
      setState(s => ({ ...s, isLoading: false, error: error as Error }));
      throw error;
    }
  }, [address, isConnected, writeContract]);

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
    if (txSuccess && !state.isLoading) {
      setState(s => ({ ...s, isLoading: false }));
      
      // Enable ZK auth in store when tx succeeds
      if (state.commitment) {
        setZKAuthEnabled(true);
      }
      
      logger.info('Transaction confirmed');
    }
  }, [txSuccess, state.isLoading, state.commitment, setZKAuthEnabled]);

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


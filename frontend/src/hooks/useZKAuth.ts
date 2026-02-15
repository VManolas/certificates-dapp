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
import type { UserRole } from '@/types/auth';
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

// ZK auth only supports student and employer roles (universities and admins use Web3 auth)
export type ZKAuthRole = 'student' | 'employer';
export type ZKAuthProgressEvent =
  | 'register_signature_required'
  | 'register_signature_complete'
  | 'register_transaction_required'
  | 'register_transaction_submitted'
  | 'register_transaction_confirmed'
  | 'login_wallet_access_required'
  | 'login_signature_required'
  | 'login_signature_complete'
  | 'login_transaction_required'
  | 'login_transaction_submitted'
  | 'login_transaction_confirmed'
  | 'logout_transaction_required'
  | 'logout_transaction_submitted'
  | 'logout_transaction_confirmed'
  | 'logout_no_active_session';

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
  const { writeContractAsync, data: txHash, isPending: isWriting, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { 
    setZKAuthEnabled, 
    setZKCommitment, 
    setZKSessionId, 
    setZKAuthenticated,
    setZKRole,
    setAuthMethod,
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
  const register = useCallback(async (role: ZKAuthRole, onProgress?: (event: ZKAuthProgressEvent) => void) => {
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
      onProgress?.('register_signature_required');
      const signature = await signer.signMessage(message);
      onProgress?.('register_signature_complete');

      const encrypted = await encryptCredentials(
        { privateKey, salt, commitment, role },
        signature,
        address
      );

      storeCredentials(encrypted, address);

      logger.info('Credentials encrypted and stored');

      // Step 5: Register commitment on-chain
      // Map role to enum: None=0, Student=1, Employer=2
      const roleEnum = 
        role === 'student' ? 1 : 
        role === 'employer' ? 2 : 
        1; // Default to student if unknown

      onProgress?.('register_transaction_required');
      const registrationTxHash = await writeContractAsync({
        address: ZK_AUTH_REGISTRY_ADDRESS,
        abi: ZKAuthRegistryABI.abi,
        functionName: 'registerCommitment',
        args: [commitment, roleEnum, proof],
      });
      onProgress?.('register_transaction_submitted');
      await provider.waitForTransaction(registrationTxHash);
      onProgress?.('register_transaction_confirmed');

      setState(s => ({ ...s, commitment, isLoading: false }));
      
      // Update auth store
      setZKCommitment(commitment);
      setZKRole(role);

      return commitment;
    } catch (error) {
      logger.error('Registration failed', error);
      setState(s => ({ ...s, isLoading: false, error: error as Error }));
      throw error;
    }
  }, [address, isConnected, writeContractAsync, setZKCommitment, setZKRole]);

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
  const login = useCallback(async (onProgress?: (event: ZKAuthProgressEvent) => void) => {
    if (!ZK_AUTH_REGISTRY_ADDRESS) {
      throw new Error('ZK Auth Registry not configured');
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
        onProgress?.('login_wallet_access_required');
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

      if (!hasStoredCredentials(accounts[0])) {
        throw new Error('No stored credentials for this wallet. Please register first.');
      }

      // Step 2: Decrypt stored credentials using wallet signature
      const encrypted = getStoredCredentials(accounts[0])!;
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      const message = 'Sign this message to decrypt your zkAuth credentials.\n\nThis signature is used locally and never leaves your device.';
      
      let signature: string;
      try {
        onProgress?.('login_signature_required');
        signature = await signer.signMessage(message);
        onProgress?.('login_signature_complete');
      } catch (err) {
        throw new Error('Signature required to decrypt credentials. Please approve the signature request.');
      }

      const credentials = await decryptCredentials(encrypted, signature, accounts[0]);
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
      onProgress?.('login_transaction_required');
      const loginTxHash = await writeContractAsync({
        address: ZK_AUTH_REGISTRY_ADDRESS,
        abi: ZKAuthRegistryABI.abi,
        functionName: 'startSession',
        args: [credentials.commitment, proof],
      });
      onProgress?.('login_transaction_submitted');
      await provider.waitForTransaction(loginTxHash);
      onProgress?.('login_transaction_confirmed');

      setState(s => ({
        ...s,
        commitment: credentials.commitment,
        sessionId: loginTxHash,
        role: credentials.role,
        isAuthenticated: true,
        isLoading: false,
      }));
      setZKAuthEnabled(true);
      setZKAuthenticated(true);
      setZKSessionId(loginTxHash);
      setAuthMethod('zk');
      
      // NOTE: Transaction submitted, but not confirmed yet
      // The transaction confirmation will be handled by the useEffect below
      logger.info('Session creation transaction submitted, waiting for confirmation...');
    } catch (error) {
      const err = error as Error;
      
      // Outdated credentials are recoverable, but login did NOT succeed.
      // Propagate the error so UI flows don't falsely mark authentication complete.
      if (err.message === 'CREDENTIALS_OUTDATED') {
        logger.info('ℹ️ Stored credentials are outdated. Please register again with the new version.');
        setState(s => ({ ...s, isLoading: false }));
        throw err;
      }
      
      logger.error('Login failed', error);
      setState(s => ({ ...s, isLoading: false, error: err }));
      throw error;
    }
  }, [writeContractAsync, setZKRole, setZKAuthEnabled, setZKAuthenticated, setZKSessionId, setAuthMethod]);

  /**
   * Logout (end session)
   */
  const logout = useCallback(async (onProgress?: (event: ZKAuthProgressEvent) => void) => {
    const isSessionNotFoundError = (error: unknown): boolean => {
      const message = error instanceof Error ? error.message : String(error);
      return message.includes('SessionNotFound');
    };

    const clearLocalSessionState = () => {
      setState({
        isAuthenticated: false,
        role: null,
        commitment: null,
        sessionId: null,
        isLoading: false,
        error: null,
      });
      setZKAuthenticated(false);
      setZKSessionId(null);
    };

    if (!state.sessionId || !ZK_AUTH_REGISTRY_ADDRESS) {
      // Just clear local state
      onProgress?.('logout_no_active_session');
      clearLocalSessionState();
      return;
    }

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      logger.info('Logging out', { sessionId: state.sessionId });

      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const sessionReader = new ethers.Contract(
        ZK_AUTH_REGISTRY_ADDRESS,
        ZKAuthRegistryABI.abi,
        provider
      );

      // Pre-check session status to avoid unnecessary failing tx prompts.
      try {
        const session = await sessionReader.getSession(state.sessionId);
        if (!session?.active) {
          logger.info('Session already inactive on-chain. Clearing local state only.');
          onProgress?.('logout_no_active_session');
          onProgress?.('logout_transaction_confirmed');
          clearLocalSessionState();
          return;
        }
      } catch (readError) {
        if (isSessionNotFoundError(readError)) {
          logger.info('Session not found on-chain. Treating as already logged out.');
          onProgress?.('logout_no_active_session');
          onProgress?.('logout_transaction_confirmed');
          clearLocalSessionState();
          return;
        }
        // If read check fails for unrelated reasons, continue with write attempt.
        logger.warn('Session pre-check failed, attempting on-chain logout anyway.', readError);
      }

      // End session on-chain
      onProgress?.('logout_transaction_required');
      const logoutTxHash = await writeContractAsync({
        address: ZK_AUTH_REGISTRY_ADDRESS,
        abi: ZKAuthRegistryABI.abi,
        functionName: 'endSession',
        args: [state.sessionId],
      });
      onProgress?.('logout_transaction_submitted');

      // Wait for confirmation so the UI can reflect pending/confirmed states.
      await provider.waitForTransaction(logoutTxHash);
      onProgress?.('logout_transaction_confirmed');

      // Clear local state after confirmation
      clearLocalSessionState();

      logger.info('Logged out successfully');
    } catch (error) {
      if (isSessionNotFoundError(error)) {
        logger.info('Session already ended (SessionNotFound). Clearing local state.');
        onProgress?.('logout_no_active_session');
        onProgress?.('logout_transaction_confirmed');
        clearLocalSessionState();
        return;
      }

      logger.error('Logout failed', error);
      setState(s => ({ ...s, isLoading: false, error: error as Error }));
    }
  }, [state.sessionId, writeContractAsync, setZKAuthenticated, setZKSessionId]);

  /**
   * Clear stored credentials (for testing)
   */
  const clearCredentials = useCallback(() => {
    clearStoredCredentials(address || undefined);
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
  }, [address, setZKAuthEnabled, setZKCommitment, setZKSessionId, setZKAuthenticated, setZKRole]);

  // Keep loading state resilient if a tx is confirmed externally.
  useEffect(() => {
    if (txSuccess && state.isLoading) {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, [txSuccess, state.isLoading]);

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
    hasCredentials: hasStoredCredentials(address),
    
    // Actions
    register,
    login,
    logout,
    clearCredentials,
  };
}


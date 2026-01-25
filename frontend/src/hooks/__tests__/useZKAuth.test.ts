// frontend/src/hooks/__tests__/useZKAuth.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useZKAuth } from '../useZKAuth';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import * as zkAuthLib from '@/lib/zkAuth';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}));

// Mock auth store
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock zkAuth library
vi.mock('@/lib/zkAuth', () => ({
  generateRandomKey: vi.fn(),
  computeCommitment: vi.fn(),
  encryptCredentials: vi.fn(),
  decryptCredentials: vi.fn(),
  storeCredentials: vi.fn(),
  getStoredCredentials: vi.fn(),
  clearStoredCredentials: vi.fn(),
  hasStoredCredentials: vi.fn(),
  generateAuthProof: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    providers: {
      Web3Provider: vi.fn(() => ({
        getSigner: vi.fn(() => ({
          signMessage: vi.fn(() => Promise.resolve('mock_signature')),
        })),
      })),
    },
    utils: {
      hexlify: vi.fn((val) => typeof val === 'string' ? val : '0x' + Buffer.from(val).toString('hex')),
      arrayify: vi.fn((val) => Buffer.from(val.slice(2), 'hex')),
      toUtf8String: vi.fn((val) => Buffer.from(val).toString('utf-8')),
      toUtf8Bytes: vi.fn((val) => Buffer.from(val, 'utf-8')),
      keccak256: vi.fn(() => '0xmockkey'),
    },
  },
}));

const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;
const mockUseWriteContract = useWriteContract as ReturnType<typeof vi.fn>;
const mockUseWaitForTransactionReceipt = useWaitForTransactionReceipt as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as ReturnType<typeof vi.fn>;

describe('useZKAuth', () => {
  let mockAuthStore: any;
  let mockWriteContract: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock auth store
    mockAuthStore = {
      zkAuth: {
        isZKAuthenticated: false,
        zkRole: null,
        zkCommitment: null,
        zkSessionId: null,
      },
      setZKAuthEnabled: vi.fn(),
      setZKCommitment: vi.fn(),
      setZKSessionId: vi.fn(),
      setZKAuthenticated: vi.fn(),
      setZKRole: vi.fn(),
    };

    mockWriteContract = vi.fn();

    mockUseAuthStore.mockReturnValue(mockAuthStore);
    mockUseAccount.mockReturnValue({ 
      address: '0x1234567890abcdef1234567890abcdef12345678', 
      isConnected: true 
    });
    mockUseWriteContract.mockReturnValue({
      writeContract: mockWriteContract,
      data: null,
      isPending: false,
      error: null,
    });
    mockUseWaitForTransactionReceipt.mockReturnValue({
      isLoading: false,
      isSuccess: false,
    });

    // Setup environment
    import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS = '0xZKAuthRegistry';

    // Mock window.ethereum
    global.window = {
      ethereum: {
        request: vi.fn(),
      },
    } as any;
  });

  afterEach(() => {
    delete import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS;
  });

  describe('Initialization', () => {
    it('should initialize with default state when not authenticated', () => {
      const { result } = renderHook(() => useZKAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.role).toBeNull();
      expect(result.current.commitment).toBeNull();
      expect(result.current.sessionId).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should sync with auth store on init', () => {
      mockAuthStore.zkAuth.isZKAuthenticated = true;
      mockAuthStore.zkAuth.zkRole = 'student';
      mockAuthStore.zkAuth.zkCommitment = '0xcommitment';
      mockAuthStore.zkAuth.zkSessionId = '0xsession';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useZKAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.role).toBe('student');
      expect(result.current.commitment).toBe('0xcommitment');
      expect(result.current.sessionId).toBe('0xsession');
    });

    it('should check for stored credentials', () => {
      (zkAuthLib.hasStoredCredentials as any).mockReturnValue(true);

      const { result } = renderHook(() => useZKAuth());

      expect(result.current.hasCredentials).toBe(true);
    });
  });

  describe('Registration', () => {
    beforeEach(() => {
      (zkAuthLib.generateRandomKey as any).mockReturnValue('0xprivatekey');
      (zkAuthLib.computeCommitment as any).mockResolvedValue('0xcommitment');
      (zkAuthLib.encryptCredentials as any).mockResolvedValue('0xencrypted');
      (zkAuthLib.generateAuthProof as any).mockResolvedValue('0xproof');
      (zkAuthLib.storeCredentials as any).mockImplementation(() => {});
    });

    it('should register new student successfully', async () => {
      const { result } = renderHook(() => useZKAuth());

      const commitment = await result.current.register('student');

      await waitFor(() => {
        expect(commitment).toBe('0xcommitment');
        expect(zkAuthLib.generateRandomKey).toHaveBeenCalledTimes(2); // privateKey and salt
        expect(zkAuthLib.computeCommitment).toHaveBeenCalled();
        expect(zkAuthLib.encryptCredentials).toHaveBeenCalled();
        expect(zkAuthLib.storeCredentials).toHaveBeenCalled();
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'registerCommitment',
            args: expect.arrayContaining(['0xcommitment', 1]), // 1 = student role
          })
        );
      });
    });

    it('should register new employer successfully', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.register('employer');

      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'registerCommitment',
            args: expect.arrayContaining(['0xcommitment', 2]), // 2 = employer role
          })
        );
      });
    });

    it('should update auth store after successful registration', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.register('student');

      await waitFor(() => {
        expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith('0xcommitment');
        expect(mockAuthStore.setZKRole).toHaveBeenCalledWith('student');
      });
    });

    it('should throw error when wallet not connected', async () => {
      mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });

      const { result } = renderHook(() => useZKAuth());

      await expect(result.current.register('student')).rejects.toThrow('Wallet not connected');
    });

    it('should throw error when registry not configured', async () => {
      delete import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS;

      const { result } = renderHook(() => useZKAuth());

      await expect(result.current.register('student')).rejects.toThrow('ZK Auth Registry not configured');
    });

    it('should handle registration errors gracefully', async () => {
      (zkAuthLib.computeCommitment as any).mockRejectedValue(new Error('Hash computation failed'));

      const { result } = renderHook(() => useZKAuth());

      await expect(result.current.register('student')).rejects.toThrow('Hash computation failed');
    });

    it('should generate ZK proof during registration', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.register('student');

      await waitFor(() => {
        expect(zkAuthLib.generateAuthProof).toHaveBeenCalledWith(
          expect.objectContaining({
            privateKey: '0xprivatekey',
            role: 'student',
          }),
          '0x1234567890abcdef1234567890abcdef12345678'
        );
      });
    });
  });

  describe('Login', () => {
    beforeEach(() => {
      (zkAuthLib.hasStoredCredentials as any).mockReturnValue(true);
      (zkAuthLib.getStoredCredentials as any).mockReturnValue('0xencrypted');
      (zkAuthLib.decryptCredentials as any).mockResolvedValue({
        privateKey: '0xprivatekey',
        salt: '0xsalt',
        commitment: '0xcommitment',
        role: 'student',
      });
      (zkAuthLib.generateAuthProof as any).mockResolvedValue('0xproof');

      (global.window.ethereum.request as any).mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']);
    });

    it('should login successfully with stored credentials', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.login();

      await waitFor(() => {
        expect(zkAuthLib.getStoredCredentials).toHaveBeenCalled();
        expect(zkAuthLib.decryptCredentials).toHaveBeenCalled();
        expect(zkAuthLib.generateAuthProof).toHaveBeenCalled();
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'startSession',
          })
        );
      });
    });

    it('should restore role from decrypted credentials', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.login();

      await waitFor(() => {
        expect(mockAuthStore.setZKRole).toHaveBeenCalledWith('student');
      });
    });

    it('should throw error when no stored credentials', async () => {
      (zkAuthLib.hasStoredCredentials as any).mockReturnValue(false);

      const { result } = renderHook(() => useZKAuth());

      await expect(result.current.login()).rejects.toThrow('No stored credentials');
    });

    it('should throw error when registry not configured', async () => {
      delete import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS;

      const { result } = renderHook(() => useZKAuth());

      await expect(result.current.login()).rejects.toThrow('ZK Auth Registry not configured');
    });

    it('should throw error when wallet not found', async () => {
      delete (global.window as any).ethereum;

      const { result } = renderHook(() => useZKAuth());

      await expect(result.current.login()).rejects.toThrow('MetaMask or compatible wallet not found');
    });

    it('should request account access during login', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.login();

      await waitFor(() => {
        expect(global.window.ethereum.request).toHaveBeenCalledWith({
          method: 'eth_requestAccounts',
        });
      });
    });

    it('should handle user rejection of account access', async () => {
      (global.window.ethereum.request as any).mockRejectedValue(new Error('User rejected'));

      const { result } = renderHook(() => useZKAuth());

      await expect(result.current.login()).rejects.toThrow('Please approve wallet access');
    });

    it('should handle outdated credentials gracefully', async () => {
      (zkAuthLib.decryptCredentials as any).mockRejectedValue(new Error('CREDENTIALS_OUTDATED'));

      const { result } = renderHook(() => useZKAuth());

      await result.current.login();

      // Should not throw, just silently handle
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Logout', () => {
    it('should logout and clear local state', async () => {
      mockAuthStore.zkAuth.zkSessionId = '0xsession';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useZKAuth());

      await result.current.logout();

      await waitFor(() => {
        expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
        expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            functionName: 'endSession',
          })
        );
      });
    });

    it('should logout without transaction when no session', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.logout();

      await waitFor(() => {
        expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
        expect(mockWriteContract).not.toHaveBeenCalled();
      });
    });

    it('should handle logout errors gracefully', async () => {
      mockAuthStore.zkAuth.zkSessionId = '0xsession';
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockWriteContract.mockImplementation(() => {
        throw new Error('Transaction failed');
      });

      const { result } = renderHook(() => useZKAuth());

      await result.current.logout();

      // Should handle error without crashing
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('Clear Credentials', () => {
    it('should clear all stored credentials and state', () => {
      const { result } = renderHook(() => useZKAuth());

      result.current.clearCredentials();

      expect(zkAuthLib.clearStoredCredentials).toHaveBeenCalled();
      expect(mockAuthStore.setZKAuthEnabled).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKRole).toHaveBeenCalledWith(null);
    });

    it('should reset local state after clearing', () => {
      const { result } = renderHook(() => useZKAuth());

      result.current.clearCredentials();

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.role).toBeNull();
      expect(result.current.commitment).toBeNull();
      expect(result.current.sessionId).toBeNull();
    });
  });

  describe('Transaction Success Handling', () => {
    it('should update auth state when transaction succeeds', async () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: false,
        isSuccess: true,
      });
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: '0xtxhash',
        isPending: false,
        error: null,
      });

      mockAuthStore.zkAuth.zkCommitment = '0xcommitment';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result, rerender } = renderHook(() => useZKAuth());

      rerender();

      await waitFor(() => {
        expect(mockAuthStore.setZKAuthEnabled).toHaveBeenCalledWith(true);
        expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(true);
        expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith('0xtxhash');
      });
    });

    it('should handle transaction errors', () => {
      const mockError = new Error('Transaction failed');
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: null,
        isPending: false,
        error: mockError,
      });

      const { result } = renderHook(() => useZKAuth());

      expect(result.current.error).toBe(mockError);
    });
  });

  describe('Loading States', () => {
    it('should show loading during write', () => {
      mockUseWriteContract.mockReturnValue({
        writeContract: mockWriteContract,
        data: null,
        isPending: true,
        error: null,
      });

      const { result } = renderHook(() => useZKAuth());

      expect(result.current.isLoading).toBe(true);
    });

    it('should show loading during confirmation', () => {
      mockUseWaitForTransactionReceipt.mockReturnValue({
        isLoading: true,
        isSuccess: false,
      });

      const { result } = renderHook(() => useZKAuth());

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('Role Restrictions', () => {
    it('should support student role', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.register('student');

      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            args: expect.arrayContaining([expect.anything(), 1]), // 1 = student
          })
        );
      });
    });

    it('should support employer role', async () => {
      const { result } = renderHook(() => useZKAuth());

      await result.current.register('employer');

      await waitFor(() => {
        expect(mockWriteContract).toHaveBeenCalledWith(
          expect.objectContaining({
            args: expect.arrayContaining([expect.anything(), 2]), // 2 = employer
          })
        );
      });
    });
  });
});

// frontend/src/hooks/__tests__/useZKAuth.test.ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useZKAuth } from '../useZKAuth';
import { useAccount, useWriteContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import * as zkAuthLib from '@/lib/zkAuth';

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useWriteContract: vi.fn(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('ethers', () => ({
  ethers: {
    providers: {
      Web3Provider: vi.fn(function () {
        return {
        getSigner: vi.fn(() => ({
          signMessage: vi.fn(() => Promise.resolve('mock_signature')),
        })),
        waitForTransaction: vi.fn(() => Promise.resolve({ status: 1 })),
      };
      }),
    },
    Contract: vi.fn(function () {
      return {
        getSession: vi.fn(() => Promise.resolve({ active: false })),
      };
    }),
  },
}));

const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;
const mockUseWriteContract = useWriteContract as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as ReturnType<typeof vi.fn>;

describe('useZKAuth', () => {
  let mockWriteContractAsync: ReturnType<typeof vi.fn>;
  let mockAuthStore: Record<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWriteContractAsync = vi.fn();
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
      setAuthMethod: vi.fn(),
    };

    mockUseAuthStore.mockReturnValue(mockAuthStore);
    mockUseAccount.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConnected: true,
    });
    mockUseWriteContract.mockReturnValue({
      writeContractAsync: mockWriteContractAsync,
      isPending: false,
      error: null,
    });

    import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS = '0x1111111111111111111111111111111111111111';
    (window as any).ethereum = {
      request: vi.fn().mockResolvedValue(['0x1234567890abcdef1234567890abcdef12345678']),
    };

    (zkAuthLib.generateRandomKey as any).mockReturnValue('0xabc');
    (zkAuthLib.computeCommitment as any).mockResolvedValue('0xcommitment');
    (zkAuthLib.encryptCredentials as any).mockResolvedValue('0xencrypted');
    (zkAuthLib.storeCredentials as any).mockImplementation(() => {});
    (zkAuthLib.hasStoredCredentials as any).mockReturnValue(true);
    (zkAuthLib.getStoredCredentials as any).mockReturnValue('0xencrypted');
    (zkAuthLib.decryptCredentials as any).mockResolvedValue({
      privateKey: '0xabc',
      salt: '0xdef',
      commitment: '0xcommitment',
      role: 'student',
    });
    (zkAuthLib.generateAuthProof as any).mockResolvedValue('0xproof');
  });

  afterEach(() => {
    delete import.meta.env.VITE_ZK_AUTH_REGISTRY_ADDRESS;
  });

  it('initializes from store state', () => {
    mockAuthStore.zkAuth.isZKAuthenticated = true;
    mockAuthStore.zkAuth.zkRole = 'student';
    mockAuthStore.zkAuth.zkCommitment = '0xcommitment';
    mockUseAuthStore.mockReturnValue(mockAuthStore);
    const { result } = renderHook(() => useZKAuth());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('student');
    expect(result.current.commitment).toBe('0xcommitment');
  });

  it('registers student and updates store', async () => {
    mockWriteContractAsync.mockResolvedValue('0xtxhash1');
    const { result } = renderHook(() => useZKAuth());

    let commitment = '';
    await act(async () => {
      commitment = await result.current.register('student');
    });
    expect(commitment).toBe('0xcommitment');

    await waitFor(() => {
      expect(mockWriteContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'registerCommitment',
          args: expect.arrayContaining(['0xcommitment', 1]),
        })
      );
      expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith('0xcommitment');
      expect(mockAuthStore.setZKRole).toHaveBeenCalledWith('student');
    });
  });

  it('logs in with credentials and activates zk auth', async () => {
    mockWriteContractAsync.mockResolvedValue('0xsessionhash');
    const { result } = renderHook(() => useZKAuth());

    await act(async () => {
      await result.current.login();
    });

    await waitFor(() => {
      expect(mockWriteContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'startSession' })
      );
      expect(mockAuthStore.setZKAuthEnabled).toHaveBeenCalledWith(true);
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(true);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith('0xsessionhash');
      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith('zk');
    });
  });

  it('throws when wallet is disconnected for register', async () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    const { result } = renderHook(() => useZKAuth());
    await act(async () => {
      await expect(result.current.register('student')).rejects.toThrow('Wallet not connected');
    });
  });

  it('throws for outdated credentials during login', async () => {
    (zkAuthLib.decryptCredentials as any).mockRejectedValue(new Error('CREDENTIALS_OUTDATED'));
    const { result } = renderHook(() => useZKAuth());
    await act(async () => {
      await expect(result.current.login()).rejects.toThrow('CREDENTIALS_OUTDATED');
    });
  });

  it('logout without active session clears local zk session state', async () => {
    const { result } = renderHook(() => useZKAuth());
    await act(async () => {
      await result.current.logout();
    });
    await waitFor(() => {
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
    });
  });

  it('clearCredentials wipes store and local state', () => {
    const { result } = renderHook(() => useZKAuth());
    act(() => {
      result.current.clearCredentials();
    });
    expect(zkAuthLib.clearStoredCredentials).toHaveBeenCalled();
    expect(mockAuthStore.setZKAuthEnabled).toHaveBeenCalledWith(false);
    expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith(null);
    expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
    expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
    expect(mockAuthStore.setZKRole).toHaveBeenCalledWith(null);
  });

  it('surfaces write errors from wagmi in error state', () => {
    const writeError = new Error('write failed');
    mockUseWriteContract.mockReturnValue({
      writeContractAsync: mockWriteContractAsync,
      isPending: false,
      error: writeError,
    });
    const { result } = renderHook(() => useZKAuth());
    expect(result.current.error).toBe(writeError);
  });
});

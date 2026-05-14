// frontend/src/hooks/__tests__/useZKAuth.test.ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useZKAuth } from '../useZKAuth';
import { useAccount, useWriteContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import * as zkAuthLib from '@/lib/zkAuth';
import { ethers } from 'ethers';

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
        isRegistered: vi.fn(() => Promise.resolve(true)),
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
      expect(zkAuthLib.storeCredentials).toHaveBeenCalledWith(
        '0xencrypted',
        '0x1234567890abcdef1234567890abcdef12345678'
      );
    });
  });

  it('does not persist credentials when registration transaction fails', async () => {
    mockWriteContractAsync.mockRejectedValue(new Error('registration failed'));
    const { result } = renderHook(() => useZKAuth());

    await act(async () => {
      await expect(result.current.register('student')).rejects.toThrow('registration failed');
    });

    expect(zkAuthLib.storeCredentials).not.toHaveBeenCalled();
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

  it('clears stale credentials when commitment is not registered on-chain', async () => {
    (ethers.Contract as any).mockImplementationOnce(function () {
      return {
        isRegistered: vi.fn().mockResolvedValue(false),
        getSession: vi.fn().mockResolvedValue({ active: false }),
      };
    });
    const { result } = renderHook(() => useZKAuth());

    await act(async () => {
      await expect(result.current.login()).rejects.toThrow('COMMITMENT_NOT_REGISTERED');
    });

    expect(mockWriteContractAsync).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'startSession' })
    );
    expect(zkAuthLib.clearStoredCredentials).toHaveBeenCalledWith(
      '0x1234567890abcdef1234567890abcdef12345678'
    );
    expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith(null);
    expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
    expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
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

  // ─────────────────────────────────────────────────────────────
  // register() — additional paths
  // ─────────────────────────────────────────────────────────────

  describe('register() — employer role and progress events', () => {
    it('uses roleEnum=2 for employer and reports correct progress events', async () => {
      mockWriteContractAsync.mockResolvedValue('0xtxhash_employer');
      const progressEvents: string[] = [];
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.register('employer', (e) => progressEvents.push(e));
      });

      expect(mockWriteContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'registerCommitment',
          args: expect.arrayContaining(['0xcommitment', 2]),
        })
      );
      expect(progressEvents).toContain('register_signature_required');
      expect(progressEvents).toContain('register_signature_complete');
      expect(progressEvents).toContain('register_transaction_required');
      expect(progressEvents).toContain('register_transaction_submitted');
      expect(progressEvents).toContain('register_transaction_confirmed');
    });

    it('does not persist credentials when wallet signature is rejected during registration', async () => {
      const provider = (ethers.providers.Web3Provider as any).mock.results[0];
      // Override the signer's signMessage to reject
      (ethers.providers.Web3Provider as any).mockImplementationOnce(function () {
        return {
          getSigner: vi.fn(() => ({
            signMessage: vi.fn().mockRejectedValue(new Error('MetaMask signature rejected')),
          })),
          waitForTransaction: vi.fn(),
        };
      });

      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await expect(result.current.register('student')).rejects.toThrow(
          'MetaMask signature rejected'
        );
      });

      expect(zkAuthLib.storeCredentials).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // login() — additional paths
  // ─────────────────────────────────────────────────────────────

  describe('login() — missing branches', () => {
    it('throws when no stored credentials exist for the wallet', async () => {
      (zkAuthLib.hasStoredCredentials as any).mockReturnValue(false);
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow(
          'No stored credentials for this wallet. Please register first.'
        );
      });

      expect(mockWriteContractAsync).not.toHaveBeenCalled();
    });

    it('throws when wallet access is rejected during eth_requestAccounts', async () => {
      (window as any).ethereum.request = vi
        .fn()
        .mockRejectedValue(new Error('User denied account access'));

      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow(
          'Please approve wallet access to decrypt your credentials'
        );
      });
    });

    it('throws when eth_requestAccounts resolves with an empty accounts array', async () => {
      (window as any).ethereum.request = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow(
          'No accounts found. Please unlock your wallet.'
        );
      });
    });

    it('clears credentials and throws COMMITMENT_NOT_REGISTERED when startSession reverts with CommitmentNotFound', async () => {
      mockWriteContractAsync.mockRejectedValue(
        new Error('execution reverted: CommitmentNotFound')
      );
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow('COMMITMENT_NOT_REGISTERED');
      });

      expect(zkAuthLib.clearStoredCredentials).toHaveBeenCalledWith(
        '0x1234567890abcdef1234567890abcdef12345678'
      );
      expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
    });

    it('stores generic login error in hook state and rethrows', async () => {
      mockWriteContractAsync.mockRejectedValue(new Error('network timeout'));
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await expect(result.current.login()).rejects.toThrow('network timeout');
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('network timeout');
      });
    });

    it('emits correct progress events during a successful login', async () => {
      mockWriteContractAsync.mockResolvedValue('0xloginhash');
      const progressEvents: string[] = [];
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.login((e) => progressEvents.push(e));
      });

      expect(progressEvents).toContain('login_wallet_access_required');
      expect(progressEvents).toContain('login_signature_required');
      expect(progressEvents).toContain('login_signature_complete');
      expect(progressEvents).toContain('login_transaction_required');
      expect(progressEvents).toContain('login_transaction_submitted');
      expect(progressEvents).toContain('login_transaction_confirmed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // logout() — with active session (endSession path)
  // ─────────────────────────────────────────────────────────────

  describe('logout() — active session paths', () => {
    beforeEach(() => {
      // Give the hook a live session so it takes the on-chain path
      mockAuthStore.zkAuth.zkSessionId = '0xactivesession';
      mockUseAuthStore.mockReturnValue(mockAuthStore);
    });

    it('calls endSession on-chain when session is active and clears state', async () => {
      mockWriteContractAsync.mockResolvedValue('0xlogouthash');
      // Override Contract to report session as active
      (ethers.Contract as any).mockImplementationOnce(function () {
        return {
          isRegistered: vi.fn().mockResolvedValue(true),
          getSession: vi.fn().mockResolvedValue({ active: true }),
        };
      });

      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockWriteContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: 'endSession' })
      );
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
    });

    it('emits progress events during an on-chain logout', async () => {
      mockWriteContractAsync.mockResolvedValue('0xlogouthash');
      (ethers.Contract as any).mockImplementationOnce(function () {
        return {
          isRegistered: vi.fn(),
          getSession: vi.fn().mockResolvedValue({ active: true }),
        };
      });

      const progressEvents: string[] = [];
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.logout((e) => progressEvents.push(e));
      });

      expect(progressEvents).toContain('logout_transaction_required');
      expect(progressEvents).toContain('logout_transaction_submitted');
      expect(progressEvents).toContain('logout_transaction_confirmed');
    });

    it('skips endSession and clears state when session is already inactive on-chain', async () => {
      // Default mock returns { active: false } — session already ended
      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
    });

    it('clears state when getSession pre-check throws SessionNotFound', async () => {
      (ethers.Contract as any).mockImplementationOnce(function () {
        return {
          isRegistered: vi.fn(),
          getSession: vi.fn().mockRejectedValue(new Error('SessionNotFound: 0xactivesession')),
        };
      });

      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
    });

    it('clears state when endSession write throws SessionNotFound', async () => {
      (ethers.Contract as any).mockImplementationOnce(function () {
        return {
          isRegistered: vi.fn(),
          getSession: vi.fn().mockResolvedValue({ active: true }),
        };
      });
      mockWriteContractAsync.mockRejectedValue(
        new Error('execution reverted: SessionNotFound')
      );

      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
    });

    it('stores error in state when endSession fails with a non-recoverable error', async () => {
      (ethers.Contract as any).mockImplementationOnce(function () {
        return {
          isRegistered: vi.fn(),
          getSession: vi.fn().mockResolvedValue({ active: true }),
        };
      });
      mockWriteContractAsync.mockRejectedValue(new Error('gas estimation failed'));

      const { result } = renderHook(() => useZKAuth());

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.error?.message).toBe('gas estimation failed');
      });
      // State should NOT have been cleared for a non-recoverable error
      expect(mockAuthStore.setZKAuthenticated).not.toHaveBeenCalled();
    });
  });
});

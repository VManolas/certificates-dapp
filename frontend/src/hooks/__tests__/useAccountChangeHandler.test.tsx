import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ZKCREDENTIALS_AUTH_STORAGE_KEY } from '@/constants/authStorage';
import { useAccountChangeHandler } from '@/hooks/useAccountChangeHandler';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;
const mockUseNavigate = useNavigate as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as ReturnType<typeof vi.fn>;

describe('useAccountChangeHandler', () => {
  const mockNavigate = vi.fn();
  const mockReset = vi.fn();
  const mockReload = vi.fn();
  let removeStorageItemSpy: ReturnType<typeof vi.spyOn<typeof Storage.prototype, 'removeItem'>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    removeStorageItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseAuthStore.mockReturnValue({ reset: mockReset });
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      connector: undefined,
    });

    (window as unknown as { queryClient?: { clear: ReturnType<typeof vi.fn> } }).queryClient = {
      clear: vi.fn(),
    };

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        reload: mockReload,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing on initial mount', () => {
    renderHook(() => useAccountChangeHandler());

    expect(mockReset).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      (window as unknown as { queryClient?: { clear: ReturnType<typeof vi.fn> } }).queryClient?.clear
    ).not.toHaveBeenCalled();
    expect(removeStorageItemSpy).not.toHaveBeenCalled();
  });

  it('clears state and reloads when connected account changes', async () => {
    mockUseAccount.mockImplementation(() => ({
      address: '0x1111111111111111111111111111111111111111',
      isConnected: true,
      connector: { name: 'MetaMask' },
    }));

    const hookOptions = { reactStrictMode: false as const };

    const { rerender } = renderHook(() => useAccountChangeHandler(), hookOptions);

    await act(async () => {
      mockUseAccount.mockImplementation(() => ({
        address: '0x2222222222222222222222222222222222222222',
        isConnected: true,
        connector: { name: 'MetaMask' },
      }));
      rerender();
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(
        (window as unknown as { queryClient?: { clear: ReturnType<typeof vi.fn> } }).queryClient?.clear
      ).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      expect(removeStorageItemSpy).toHaveBeenCalledTimes(1);
      expect(removeStorageItemSpy).toHaveBeenCalledWith(ZKCREDENTIALS_AUTH_STORAGE_KEY);
    });

    await waitFor(
      () => {
        expect(mockReload).toHaveBeenCalledTimes(1);
      },
      { timeout: 3000 }
    );
  });

  it('clears state and redirects on disconnect', async () => {
    mockUseAccount.mockImplementation(() => ({
      address: '0x1111111111111111111111111111111111111111',
      isConnected: true,
      connector: { name: 'MetaMask' },
    }));

    const hookOptions = { reactStrictMode: false as const };

    const { rerender } = renderHook(() => useAccountChangeHandler(), hookOptions);

    await act(async () => {
      mockUseAccount.mockImplementation(() => ({
        address: undefined,
        isConnected: false,
        connector: { name: 'MetaMask' },
      }));
      rerender();
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(
        (window as unknown as { queryClient?: { clear: ReturnType<typeof vi.fn> } }).queryClient?.clear
      ).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      expect(removeStorageItemSpy).toHaveBeenCalledTimes(1);
      expect(removeStorageItemSpy).toHaveBeenCalledWith(ZKCREDENTIALS_AUTH_STORAGE_KEY);
    });

    expect(mockReload).not.toHaveBeenCalled();
  });
});

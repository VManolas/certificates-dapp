import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuspensionGuard } from '@/components/SuspensionGuard';

const mockDisconnect = vi.fn();
const mockNavigate = vi.fn();

let mockAccountState: { address?: `0x${string}`; isConnected: boolean } = {
  address: undefined,
  isConnected: false,
};

let mockInstitutionState = {
  isRegistered: false,
  isVerified: false,
  isActive: true,
  canIssue: false,
  isLoading: false,
  institutionData: null as { walletAddress: string } | null,
  refetch: vi.fn(),
};

vi.mock('wagmi', () => ({
  useAccount: () => mockAccountState,
  useDisconnect: () => ({ disconnect: mockDisconnect }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/hooks/useInstitutionStatus', () => ({
  useInstitutionStatus: () => mockInstitutionState,
}));

vi.mock('@/lib/adminContact', () => ({
  ADMIN_CONTACT_EMAIL: 'admin@example.com',
  withAdminContact: (message: string) => `${message} Please contact the admin at: admin@example.com`,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SuspensionGuard modal lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountState = { address: undefined, isConnected: false };
    mockInstitutionState = {
      isRegistered: false,
      isVerified: false,
      isActive: true,
      canIssue: false,
      isLoading: false,
      institutionData: null,
      refetch: vi.fn(),
    };
  });

  it('clears suspended modal when switching to active wallet', async () => {
    const { rerender } = render(<SuspensionGuard />);

    // First connect suspended university wallet -> modal should open.
    mockAccountState = {
      address: '0x1111111111111111111111111111111111111111',
      isConnected: true,
    };
    mockInstitutionState = {
      ...mockInstitutionState,
      isRegistered: true,
      isVerified: true,
      isActive: false,
      canIssue: false,
      isLoading: false,
      institutionData: { walletAddress: '0x1111111111111111111111111111111111111111' },
    };
    rerender(<SuspensionGuard />);

    await waitFor(() => {
      expect(screen.getByText('Institution Suspended')).toBeInTheDocument();
    });
    expect(mockDisconnect).toHaveBeenCalled();

    // Then connect a different active university wallet -> stale modal must disappear.
    mockAccountState = {
      address: '0x2222222222222222222222222222222222222222',
      isConnected: true,
    };
    mockInstitutionState = {
      ...mockInstitutionState,
      isRegistered: true,
      isVerified: true,
      isActive: true,
      canIssue: true,
      isLoading: false,
      institutionData: { walletAddress: '0x2222222222222222222222222222222222222222' },
    };
    rerender(<SuspensionGuard />);

    await waitFor(() => {
      expect(screen.queryByText('Institution Suspended')).not.toBeInTheDocument();
    });
  });

  it('does not disconnect when institution status data belongs to another wallet', async () => {
    const { rerender } = render(<SuspensionGuard />);

    mockAccountState = {
      address: '0x2222222222222222222222222222222222222222',
      isConnected: true,
    };
    mockInstitutionState = {
      ...mockInstitutionState,
      isRegistered: true,
      isVerified: true,
      isActive: false,
      canIssue: false,
      isLoading: false,
      // Stale query data from previously connected suspended wallet.
      institutionData: { walletAddress: '0x1111111111111111111111111111111111111111' },
    };

    rerender(<SuspensionGuard />);

    await waitFor(() => {
      expect(mockDisconnect).not.toHaveBeenCalled();
      expect(screen.queryByText('Institution Suspended')).not.toBeInTheDocument();
    });
  });
});

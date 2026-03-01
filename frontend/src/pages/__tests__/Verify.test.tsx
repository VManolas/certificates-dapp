import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Verify } from '@/pages/Verify';

const secureTokenHash = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

let mockRole: 'employer' | null = null;
let verificationEnabledCalls = 0;

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams('v=v1.mock-token')],
  useNavigate: () => vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: true }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    removeQueries: vi.fn(),
    cancelQueries: vi.fn(),
  }),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    role: mockRole,
    preSelectedRole: null,
    setPreSelectedRole: vi.fn(),
  }),
  useEffectiveRole: () => mockRole,
  useIsAuthenticated: () => true,
}));

vi.mock('@/lib/verificationToken', () => ({
  verifyVerificationToken: () => ({
    valid: true,
    payload: { h: secureTokenHash },
    signer: '0x1111111111111111111111111111111111111111',
  }),
}));

vi.mock('@/hooks/useVerificationHistory', () => ({
  useVerificationHistory: () => ({
    addEntry: vi.fn(),
  }),
}));

vi.mock('@/hooks', () => ({
  useHashExists: () => ({ isLoading: false }),
  useCertificateDetails: () => ({
    certificate: {
      studentWallet: '0x1111111111111111111111111111111111111111',
      issuingInstitution: '0x2222222222222222222222222222222222222222',
      issueDate: 1n,
      documentHash: secureTokenHash,
      isRevoked: false,
    },
    isLoading: false,
    error: null,
  }),
  useCertificateVerification: (_hash?: string, enabled?: boolean) => {
    if (enabled) {
      verificationEnabledCalls += 1;
      if (verificationEnabledCalls === 1) {
        return {
          isValid: true,
          isRevoked: false,
          certificateId: 1n,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
          verificationTimestamp: new Date('2026-02-23T12:00:00.000Z'),
          verificationId: 'verification-1',
        };
      }
      // Simulate stale/empty verification data if a second enabled cycle starts.
      return {
        isValid: undefined,
        isRevoked: false,
        certificateId: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        verificationTimestamp: undefined,
        verificationId: undefined,
      };
    }

    return {
      isValid: true,
      isRevoked: false,
      certificateId: 1n,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      verificationTimestamp: new Date('2026-02-23T12:00:00.000Z'),
      verificationId: 'verification-1',
    };
  },
}));

vi.mock('@/components/QRScanner', () => ({
  QRScanner: () => null,
}));

vi.mock('@/components/VerificationReport', () => ({
  VerificationReport: () => null,
}));

vi.mock('@/components/CertificateDetailModal', () => ({
  CertificateDetailModal: () => null,
}));

vi.mock('@/components/RoleSelector', () => ({
  RoleSelector: () => null,
}));

vi.mock('@/components/UnifiedLoginModal', () => ({
  UnifiedLoginModal: () => null,
}));

vi.mock('@/lib/wagmi', () => ({
  CERTIFICATE_REGISTRY_ADDRESS: '0x3333333333333333333333333333333333333333',
}));

describe('Verify token flow stability', () => {
  beforeEach(() => {
    mockRole = null;
    verificationEnabledCalls = 0;
  });

  it('keeps token verification result visible across auth-role updates', async () => {
    const { rerender } = render(<Verify />);

    await waitFor(() => {
      expect(screen.getByText('Valid Certificate')).toBeInTheDocument();
    });

    mockRole = 'employer';
    rerender(<Verify />);

    await waitFor(() => {
      expect(screen.getByText('Valid Certificate')).toBeInTheDocument();
    });
  });
});

// frontend/src/pages/__tests__/Verify.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Verify } from '@/pages/Verify';
import type { HashResult } from '@/lib/pdfHash';

// ─── stable vi.fn() references (must be hoisted before vi.mock factories) ───

const {
  mockNavigate,
  mockAddEntry,
  mockRefetch,
  mockSetPreSelectedRole,
  mockValidatePdfFile,
  mockRateLimiterIsAllowed,
  mockRateLimiterGetRemaining,
  mockGeneratePDFHash,
  mockWithRetry,
  mockParseError,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAddEntry: vi.fn(),
  mockRefetch: vi.fn(),
  mockSetPreSelectedRole: vi.fn(),
  mockValidatePdfFile: vi.fn(() => ({ valid: true })),
  mockRateLimiterIsAllowed: vi.fn(() => true),
  mockRateLimiterGetRemaining: vi.fn(() => 0),
  mockGeneratePDFHash: vi.fn(),
  mockWithRetry: vi.fn(async (fn: () => unknown) => fn()),
  mockParseError: vi.fn((err: unknown) => ({
    message: err instanceof Error ? err.message : 'Unknown error',
    type: 'UNKNOWN',
    retryable: false,
  })),
}));

// ─── Mutable state threaded through mock factories ───────────────────────────

const SECURE_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
const STUDENT_WALLET = '0x1111111111111111111111111111111111111111' as `0x${string}`;
const INSTITUTION  = '0x2222222222222222222222222222222222222222' as `0x${string}`;
const TOKEN_SIGNER  = '0x3333333333333333333333333333333333333333' as `0x${string}`;

let mockSearchParamsStr = '';
let mockIsConnected = true;
let mockIsAuthenticated = true;
let mockEffectiveRole: string | null = 'employer';
let mockRole: string | null = 'employer';
let mockPreSelectedRole: string | null = null;

// verifyVerificationToken result — null means no ?v= param in URL; never called
let mockTokenResult: {
  valid: boolean;
  payload?: { h: `0x${string}` };
  signer?: `0x${string}`;
  reason?: string;
} = { valid: false };

// useCertificateVerification mock result
let mockVerifyResult = {
  isValid: undefined as boolean | undefined,
  isRevoked: false,
  certificateId: undefined as bigint | undefined,
  isLoading: false,
  error: null as Error | null,
  verificationTimestamp: undefined as Date | undefined,
  verificationId: 'verification-1',
};

// useCertificateDetails (shared for both calls in the component)
let mockCertDetails = {
  certificate: null as {
    studentWallet: `0x${string}`;
    issuingInstitution: `0x${string}`;
    issueDate: bigint;
    documentHash: `0x${string}`;
    isRevoked: boolean;
  } | null,
  isLoading: false,
  error: null as Error | null,
};

// generatePDFHash return value
let mockHashResult: HashResult = {
  hash: SECURE_HASH,
  fileName: 'test.pdf',
  fileSize: 1024,
  pageCount: 3,
};

// ─── vi.mock declarations ─────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(mockSearchParamsStr)],
  useNavigate: () => mockNavigate,
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: mockIsConnected }),
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
    preSelectedRole: mockPreSelectedRole,
    setPreSelectedRole: (role: string | null) => {
      mockPreSelectedRole = role;
      mockSetPreSelectedRole(role);
    },
  }),
  useEffectiveRole: () => mockEffectiveRole,
  useIsAuthenticated: () => mockIsAuthenticated,
}));

vi.mock('@/lib/verificationToken', () => ({
  verifyVerificationToken: () => mockTokenResult,
}));

vi.mock('@/hooks/useVerificationHistory', () => ({
  useVerificationHistory: () => ({ addEntry: mockAddEntry }),
}));

vi.mock('@/hooks', () => ({
  useHashExists: () => ({ isLoading: false }),
  useCertificateDetails: () => mockCertDetails,
  // Always return mockVerifyResult regardless of `enabled`: once state transitions
  // from 'verifying' to 'complete', enabled flips to false, but the result values
  // must persist so the completed result card renders correctly.
  useCertificateVerification: () => ({ ...mockVerifyResult, refetch: mockRefetch }),
}));

vi.mock('@/components/QRScanner', () => ({
  QRScanner: () => <div data-testid="qr-scanner" />,
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
  UnifiedLoginModal: ({
    isOpen,
    onClose,
    onSuccess,
    preSelectedRole,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    preSelectedRole: string | null;
  }) =>
    isOpen ? (
      <div data-testid="login-modal">
        <span>{preSelectedRole}</span>
        <button onClick={onSuccess}>Mock Login Success</button>
        <button onClick={onClose}>Mock Login Close</button>
      </div>
    ) : null,
}));

vi.mock('@/lib/wagmi', () => ({
  CERTIFICATE_REGISTRY_ADDRESS: '0x3333333333333333333333333333333333333333',
}));

vi.mock('@/lib/pdfHash', () => ({
  generatePDFHash: mockGeneratePDFHash,
  formatFileSize: vi.fn((bytes: number) => `${bytes} B`),
  truncateHash: vi.fn((hash: string) => hash),
}));

vi.mock('@/lib/sanitization', () => ({
  validatePdfFile: mockValidatePdfFile,
  globalRateLimiter: {
    isAllowed: mockRateLimiterIsAllowed,
    getRemainingAttempts: mockRateLimiterGetRemaining,
  },
}));

vi.mock('@/lib/errorHandling', () => ({
  withRetry: mockWithRetry,
  parseError: mockParseError,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    userAction: vi.fn(),
  },
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

function setValidTokenParams() {
  mockSearchParamsStr = 'v=v1.mock-token';
  mockTokenResult = {
    valid: true,
    payload: { h: SECURE_HASH },
    signer: STUDENT_WALLET,
  };
}

function setValidVerifyResult() {
  mockVerifyResult = {
    isValid: true,
    isRevoked: false,
    certificateId: 1n,
    isLoading: false,
    error: null,
    verificationTimestamp: new Date('2026-02-23T12:00:00.000Z'),
    verificationId: 'verification-1',
  };
  mockCertDetails = {
    certificate: {
      studentWallet: STUDENT_WALLET,
      issuingInstitution: INSTITUTION,
      issueDate: 1n,
      documentHash: SECURE_HASH,
      isRevoked: false,
    },
    isLoading: false,
    error: null,
  };
}

// ─── Test suites ──────────────────────────────────────────────────────────────

describe('Verify page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // reset all mutable state to safe defaults
    mockSearchParamsStr = '';
    mockIsConnected = true;
    mockIsAuthenticated = true;
    mockEffectiveRole = 'employer';
    mockRole = 'employer';
    mockPreSelectedRole = null;
    mockTokenResult = { valid: false };
    mockVerifyResult = {
      isValid: undefined,
      isRevoked: false,
      certificateId: undefined,
      isLoading: false,
      error: null,
      verificationTimestamp: undefined,
      verificationId: 'verification-1',
    };
    mockCertDetails = {
      certificate: {
        studentWallet: STUDENT_WALLET,
        issuingInstitution: INSTITUTION,
        issueDate: 1n,
        documentHash: SECURE_HASH,
        isRevoked: false,
      },
      isLoading: false,
      error: null,
    };
    mockHashResult = {
      hash: SECURE_HASH,
      fileName: 'test.pdf',
      fileSize: 1024,
      pageCount: 3,
    };

    mockGeneratePDFHash.mockResolvedValue(mockHashResult);
    mockWithRetry.mockImplementation(async (fn: () => unknown) => fn());
    mockValidatePdfFile.mockReturnValue({ valid: true });
    mockRateLimiterIsAllowed.mockReturnValue(true);
    mockRateLimiterGetRemaining.mockReturnValue(5);
    mockParseError.mockImplementation((err: unknown) => ({
      message: err instanceof Error ? err.message : 'Unknown error',
      type: 'UNKNOWN',
      retryable: false,
    }));
  });

  // ── Idle state rendering ────────────────────────────────────────────────────

  describe('idle state', () => {
    it('shows the PDF upload area', () => {
      render(<Verify />);
      expect(screen.getByText('Drop your PDF here')).toBeInTheDocument();
    });

    it('shows action buttons in the header', () => {
      render(<Verify />);
      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      expect(screen.getByText('Paste Verification Link')).toBeInTheDocument();
    });
  });

  // ── Token flow (?v=...) ─────────────────────────────────────────────────────

  describe('token flow (?v=...)', () => {
    beforeEach(() => {
      setValidTokenParams();
      setValidVerifyResult();
    });

    it('valid token shows "Valid Certificate"', async () => {
      render(<Verify />);
      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );
    });

    it('invalid token shows the rejection reason', async () => {
      mockTokenResult = { valid: false, reason: 'Token has expired' };
      render(<Verify />);
      await waitFor(() =>
        expect(screen.getByText('Token has expired')).toBeInTheDocument()
      );
    });

    it('revoked certificate shows "Certificate Revoked"', async () => {
      mockVerifyResult = {
        ...mockVerifyResult,
        isValid: false,
        isRevoked: true,
        certificateId: 2n,
        isLoading: false,
        error: null,
      };
      render(<Verify />);
      await waitFor(() =>
        expect(screen.getByText('Certificate Revoked')).toBeInTheDocument()
      );
    });

    it('unknown certificate shows "Certificate Not Found"', async () => {
      mockVerifyResult = {
        ...mockVerifyResult,
        isValid: false,
        isRevoked: false,
        certificateId: undefined,
        isLoading: false,
        error: null,
      };
      render(<Verify />);
      await waitFor(() =>
        expect(screen.getByText('Certificate Not Found')).toBeInTheDocument()
      );
    });

    it('keeps token verification result visible across auth-role updates', async () => {
      const { rerender } = render(<Verify />);

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );

      mockRole = null;
      mockEffectiveRole = null;
      rerender(<Verify />);

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );
    });
  });

  // ── Hash URL flow (?hash=...) ───────────────────────────────────────────────

  describe('hash URL flow (?hash=...)', () => {
    beforeEach(() => {
      setValidVerifyResult();
    });

    it('authenticated user with role can verify via hash link', async () => {
      mockSearchParamsStr = `hash=${SECURE_HASH}`;
      // canUseInternalHashMode = isConnected && isAuthenticated && !!effectiveRole
      mockIsConnected = true;
      mockIsAuthenticated = true;
      mockEffectiveRole = 'employer';

      render(<Verify />);
      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );
    });

    it('unauthenticated user sees "Public hash links are disabled" error', async () => {
      mockSearchParamsStr = `hash=${SECURE_HASH}`;
      mockIsAuthenticated = false;
      mockEffectiveRole = null;

      render(<Verify />);
      await waitFor(() =>
        expect(
          screen.getByText(/Public hash links are disabled/i)
        ).toBeInTheDocument()
      );
    });

    it('malformed hash shows invalid format error', async () => {
      mockSearchParamsStr = 'hash=not-a-valid-hash';

      render(<Verify />);
      await waitFor(() =>
        expect(
          screen.getByText(/Invalid verification link format/i)
        ).toBeInTheDocument()
      );
    });
  });

  // ── Legacy cert param (?cert=...) ───────────────────────────────────────────

  describe('legacy cert param (?cert=...)', () => {
    it('shows "no longer supported" error', async () => {
      mockSearchParamsStr = 'cert=42';

      render(<Verify />);
      await waitFor(() =>
        expect(
          screen.getByText(/Legacy certificate-ID links are no longer supported/i)
        ).toBeInTheDocument()
      );
    });
  });

  // ── PDF file upload ─────────────────────────────────────────────────────────

  describe('PDF file upload', () => {
    function uploadFile(container: HTMLElement, file: File) {
      const input = container.querySelector('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [file] } });
    }

    it('valid PDF upload transitions through hashing → verifying → complete', async () => {
      mockVerifyResult = {
        ...mockVerifyResult,
        isValid: true,
        isRevoked: false,
        certificateId: 1n,
        isLoading: false,
        error: null,
      };

      const { container } = render(<Verify />);
      const file = new File(['pdf content'], 'cert.pdf', { type: 'application/pdf' });
      uploadFile(container, file);

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );
      expect(mockGeneratePDFHash).toHaveBeenCalledWith(file);
    });

    it('drag and drop triggers the same verification flow', async () => {
      mockVerifyResult = {
        ...mockVerifyResult,
        isValid: true,
        isRevoked: false,
        certificateId: 1n,
        isLoading: false,
        error: null,
      };

      render(<Verify />);
      const dropZone = screen.getByText('Drop your PDF here').closest('div')!;
      const file = new File(['pdf'], 'cert.pdf', { type: 'application/pdf' });

      fireEvent.dragOver(dropZone, { preventDefault: vi.fn() });
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
        preventDefault: vi.fn(),
      });

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );
    });

    it('validatePdfFile failure shows error and keeps idle state', async () => {
      mockValidatePdfFile.mockReturnValue({
        valid: false,
        error: 'File size exceeds limit',
      });

      const { container } = render(<Verify />);
      const file = new File(['data'], 'big.pdf', { type: 'application/pdf' });
      uploadFile(container, file);

      await waitFor(() =>
        expect(screen.getByText('File size exceeds limit')).toBeInTheDocument()
      );
      expect(mockGeneratePDFHash).not.toHaveBeenCalled();
    });

    it('rate limit exceeded shows rate limit error', async () => {
      mockRateLimiterIsAllowed.mockReturnValue(false);
      mockRateLimiterGetRemaining.mockReturnValue(0);

      const { container } = render(<Verify />);
      const file = new File(['pdf'], 'cert.pdf', { type: 'application/pdf' });
      uploadFile(container, file);

      await waitFor(() =>
        expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument()
      );
      expect(mockGeneratePDFHash).not.toHaveBeenCalled();
    });

    it('generatePDFHash error shows parsed error message', async () => {
      mockGeneratePDFHash.mockRejectedValue(new Error('PDF parsing failed'));

      const { container } = render(<Verify />);
      const file = new File(['pdf'], 'cert.pdf', { type: 'application/pdf' });
      uploadFile(container, file);

      await waitFor(() =>
        expect(screen.getByText('PDF parsing failed')).toBeInTheDocument()
      );
    });
  });

  // ── Paste Verification Link modal ───────────────────────────────────────────

  describe('Paste Verification Link modal', () => {
    it('opens when "Paste Verification Link" button is clicked', () => {
      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));
      expect(screen.getByText('Paste Verification Link', { selector: 'h2' })).toBeInTheDocument();
    });

    it('closes with the X button', () => {
      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));
      // The close button is an SVG-only button next to the heading
      const modal = screen.getByRole('heading', { name: 'Paste Verification Link' }).closest('div')!;
      const closeButton = modal.querySelector('button[class*="text-surface"]')!;
      fireEvent.click(closeButton);
      expect(screen.queryByRole('heading', { name: 'Paste Verification Link' })).not.toBeInTheDocument();
    });

    it('empty submission shows "Please enter a verification link" error', async () => {
      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));
      // Verify button is disabled when input is empty; trigger via Enter key instead
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });
      // Error renders both inside the modal and in the main error card
      await waitFor(() =>
        expect(
          screen.getAllByText('Please enter a verification link').length
        ).toBeGreaterThan(0)
      );
    });

    it('pasting a URL with ?v= token navigates to ?v= route', async () => {
      mockTokenResult = { valid: true, payload: { h: SECURE_HASH }, signer: STUDENT_WALLET };

      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));

      const input = screen.getByPlaceholderText(/https:\/\/example.com\/verify\?v=/i);
      fireEvent.change(input, {
        target: { value: 'https://example.com/verify?v=v1.mock-token' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/verify?v=')
        )
      );
    });

    it('pasting a legacy ?cert= URL shows "no longer supported" error and does not navigate', async () => {
      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));

      const input = screen.getByRole('textbox');
      fireEvent.change(input, {
        target: { value: 'https://example.com/verify?cert=42' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

      // The error may render in both the modal and the main page — at least one must appear
      await waitFor(() =>
        expect(
          screen.getAllByText(/Legacy certificate-ID links are no longer supported/i).length
        ).toBeGreaterThan(0)
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('pasting a raw v1. token navigates to ?v= route', async () => {
      mockTokenResult = { valid: true, payload: { h: SECURE_HASH }, signer: STUDENT_WALLET };

      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'v1.mock-token' } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.stringContaining('/verify?v=')
        )
      );
    });

    it('pasting a valid raw hash while authenticated navigates to hash route', async () => {
      mockIsConnected = true;
      mockIsAuthenticated = true;
      mockEffectiveRole = 'employer';

      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));

      const input = screen.getByRole('textbox');
      fireEvent.change(input, {
        target: { value: `0x${SECURE_HASH.slice(2).toUpperCase()}` },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(`/verify?hash=${SECURE_HASH}`)
      );
    });

    it('pasting a valid raw hash while unauthenticated shows secure-link error', async () => {
      mockIsConnected = false;
      mockIsAuthenticated = false;
      mockEffectiveRole = null;

      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: SECURE_HASH } });
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

      await waitFor(() =>
        expect(
          screen.getAllByText(/Public hash links are disabled/i).length
        ).toBeGreaterThan(0)
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('pasting an invalid token shows token validation error and does not navigate', async () => {
      mockTokenResult = { valid: false, reason: 'Invalid signature' };

      render(<Verify />);
      fireEvent.click(screen.getByText('Paste Verification Link'));

      const input = screen.getByRole('textbox');
      fireEvent.change(input, {
        target: { value: 'https://example.com/verify?v=v1.bad-token' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

      await waitFor(() =>
        expect(screen.getAllByText('Invalid signature').length).toBeGreaterThan(0)
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ── QR scanner ──────────────────────────────────────────────────────────────

  describe('QR scanner', () => {
    it('clicking "Scan QR Code" renders the QRScanner component', () => {
      render(<Verify />);
      expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Scan QR Code'));
      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
    });
  });

  // ── Security info banner ────────────────────────────────────────────────────

  describe('security info banner', () => {
    it('expands on first click to show extended description', () => {
      render(<Verify />);
      const banner = screen.getByRole('button', { name: /Security update/i });
      expect(banner).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(banner);
      expect(banner).toHaveAttribute('aria-expanded', 'true');
      expect(
        screen.getByText(/protect against certificate enumeration/i)
      ).toBeInTheDocument();
    });

    it('collapses on second click', () => {
      render(<Verify />);
      const banner = screen.getByRole('button', { name: /Security update/i });

      fireEvent.click(banner);
      expect(banner).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(banner);
      expect(banner).toHaveAttribute('aria-expanded', 'false');
    });
  });

  // ── Login button visibility ──────────────────────────────────────────────────

  describe('login button', () => {
    it('shows Login button when not connected', () => {
      mockIsConnected = false;
      render(<Verify />);
      expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
    });

    it('hides Login button when connected', () => {
      mockIsConnected = true;
      render(<Verify />);
      expect(screen.queryByRole('button', { name: /^Login$/i })).not.toBeInTheDocument();
    });

    it('opens employer login flow and preselects employer role when disconnected', () => {
      mockIsConnected = false;

      render(<Verify />);
      fireEvent.click(screen.getByRole('button', { name: /^Login$/i }));

      expect(mockSetPreSelectedRole).toHaveBeenCalledWith('employer');
      expect(screen.getByTestId('login-modal')).toBeInTheDocument();
      expect(screen.getByTestId('login-modal')).toHaveTextContent('employer');
    });

    it('closes the login modal after successful login', () => {
      mockIsConnected = false;

      render(<Verify />);
      fireEvent.click(screen.getByRole('button', { name: /^Login$/i }));
      expect(screen.getByTestId('login-modal')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Mock Login Success' }));

      expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();
    });
  });

  // ── Employer verification logging ────────────────────────────────────────────

  describe('employer verification logging', () => {
    it('calls addEntry when employer role completes a verification', async () => {
      setValidTokenParams();
      setValidVerifyResult();
      mockEffectiveRole = 'employer';

      render(<Verify />);

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );

      expect(mockAddEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationType: 'pdf',
          isValid: true,
          isRevoked: false,
        })
      );
    });

    it('does NOT call addEntry for non-employer roles', async () => {
      setValidTokenParams();
      setValidVerifyResult();
      mockEffectiveRole = 'student';

      render(<Verify />);

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );

      expect(mockAddEntry).not.toHaveBeenCalled();
    });
  });

  // ── Reset verification ───────────────────────────────────────────────────────

  describe('resetVerification', () => {
    it('"Verify Another Certificate" button resets to idle and shows upload area', async () => {
      setValidVerifyResult();

      const { container } = render(<Verify />);
      const file = new File(['pdf'], 'cert.pdf', { type: 'application/pdf' });
      const input = container.querySelector('input[type="file"]')!;
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );

      fireEvent.click(screen.getByText('Verify Another Certificate'));

      await waitFor(() =>
        expect(screen.getByText('Drop your PDF here')).toBeInTheDocument()
      );
      expect(screen.queryByText('Valid Certificate')).not.toBeInTheDocument();
    });
  });

  // ── Token signer validation ──────────────────────────────────────────────────

  describe('token signer validation', () => {
    it('shows "Unauthorized Verification Link" when signer is not student or institution', async () => {
      const UNAUTHORIZED_SIGNER = '0x9999999999999999999999999999999999999999' as `0x${string}`;

      mockSearchParamsStr = 'v=v1.mock-token';
      mockTokenResult = {
        valid: true,
        payload: { h: SECURE_HASH },
        signer: UNAUTHORIZED_SIGNER,
      };
      mockVerifyResult = {
        isValid: true,
        isRevoked: false,
        certificateId: 1n,
        isLoading: false,
        error: null,
        verificationTimestamp: new Date(),
        verificationId: 'verification-1',
      };
      // Certificate student/institution do NOT match the token signer
      mockCertDetails = {
        certificate: {
          studentWallet: STUDENT_WALLET,      // 0x1111...
          issuingInstitution: INSTITUTION,     // 0x2222...
          issueDate: 1n,
          documentHash: SECURE_HASH,
          isRevoked: false,
        },
        isLoading: false,
        error: null,
      };

      render(<Verify />);

      await waitFor(() =>
        expect(
          screen.getByText('Unauthorized Verification Link')
        ).toBeInTheDocument()
      );
      // Status card must be hidden when auth error is set
      expect(screen.queryByText('Valid Certificate')).not.toBeInTheDocument();
    });

    it('does not show auth error when signer matches the student wallet', async () => {
      setValidTokenParams(); // signer = STUDENT_WALLET
      setValidVerifyResult(); // studentWallet = STUDENT_WALLET

      render(<Verify />);

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );
      expect(
        screen.queryByText('Unauthorized Verification Link')
      ).not.toBeInTheDocument();
    });

    it('does not show auth error when signer matches the issuing institution', async () => {
      mockSearchParamsStr = 'v=v1.mock-token';
      mockTokenResult = {
        valid: true,
        payload: { h: SECURE_HASH },
        signer: INSTITUTION,
      };
      setValidVerifyResult();

      render(<Verify />);

      await waitFor(() =>
        expect(screen.getByText('Valid Certificate')).toBeInTheDocument()
      );
      expect(
        screen.queryByText('Unauthorized Verification Link')
      ).not.toBeInTheDocument();
    });
  });

  // ── Verifying spinner (isLoading=true) ───────────────────────────────────────

  describe('loading state', () => {
    it('shows "Verifying On-Chain..." spinner when useCertificateVerification is loading', async () => {
      setValidTokenParams();
      mockVerifyResult = {
        ...mockVerifyResult,
        isValid: undefined,
        isLoading: true,
        error: null,
      };

      render(<Verify />);

      await waitFor(() =>
        expect(screen.getByText('Verifying On-Chain...')).toBeInTheDocument()
      );
    });
  });
});

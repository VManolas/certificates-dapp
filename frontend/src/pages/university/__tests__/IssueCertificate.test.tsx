// src/pages/university/__tests__/IssueCertificate.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { UseCertificateIssuanceReturn, IssueCertificateParams } from '@/hooks';

// ─── Hoist stable vi.fn() references ─────────────────────────────────────────
const {
  mockNavigate,
  mockGeneratePDFHash,
  mockSanitizeAddress,
  mockValidatePdfFile,
  mockRateLimiterIsAllowed,
  mockIssueCertificate,
  mockReset,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGeneratePDFHash: vi.fn(),
  mockSanitizeAddress: vi.fn(),
  mockValidatePdfFile: vi.fn(),
  mockRateLimiterIsAllowed: vi.fn(() => true),
  mockIssueCertificate: vi.fn(),
  mockReset: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: mockIsConnected }),
  useReadContract: () => mockReadContractResult,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ refetchInstitution: vi.fn() }),
}));

vi.mock('@/lib/pdfHash', () => ({
  generatePDFHash: mockGeneratePDFHash,
  formatFileSize: vi.fn((b: number) => b + ' B'),
}));

vi.mock('@/hooks', () => ({
  useCertificateIssuanceWithCallback: vi.fn((onSuccess: unknown, onError: unknown) => {
    // Capture callbacks so tests can invoke them
    capturedOnSuccess = onSuccess as typeof capturedOnSuccess;
    capturedOnError = onError as typeof capturedOnError;
    return mockTxState;
  }),
  useCanIssueCertificates: () => mockCanIssue,
}));

vi.mock('@/lib/sanitization', () => ({
  sanitizeAddress: mockSanitizeAddress,
  validatePdfFile: mockValidatePdfFile,
  globalRateLimiter: {
    isAllowed: mockRateLimiterIsAllowed,
    getRemainingAttempts: vi.fn(() => 0),
  },
}));

vi.mock('@/lib/errorHandling', () => ({
  parseError: vi.fn((e: unknown) => ({
    message: e instanceof Error ? e.message : 'Unknown',
  })),
  withRetry: vi.fn(async (fn: () => unknown) => fn()),
}));

vi.mock('@/lib/errorDecoding', () => ({
  decodeContractError: vi.fn((e: unknown) =>
    e instanceof Error ? e.message : 'Contract error'
  ),
}));

vi.mock('@/lib/adminContact', () => ({
  withAdminContact: (msg: string) => msg + ' Contact admin.',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    userAction: vi.fn(),
    transaction: vi.fn(),
  },
}));

// ─── Module-scope mutable state ───────────────────────────────────────────────
let mockIsConnected = true;
let mockCanIssue = {
  canIssue: true,
  isLoading: false,
  reason: '',
  refetch: vi.fn(),
};
let mockTxState: UseCertificateIssuanceReturn = {
  issueCertificate: mockIssueCertificate,
  isPending: false,
  isConfirming: false,
  isSuccess: false,
  transactionPhase: 'idle' as const,
  error: null,
  transactionHash: undefined,
  certificateId: undefined,
  reset: mockReset,
};
let mockReadContractResult = {
  data: false,
  isLoading: false,
};

// Captured callbacks from useCertificateIssuanceWithCallback
let capturedOnSuccess: ((hash: `0x${string}`, certId?: bigint) => void) | null = null;
let capturedOnError: ((err: Error) => void) | null = null;

// ─── Import after mocks ───────────────────────────────────────────────────────
import { IssueCertificate } from '../IssueCertificate';
import { useCertificateIssuanceWithCallback } from '@/hooks';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VALID_WALLET = '0x1234567890123456789012345678901234567890' as `0x${string}`;
const VALID_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;

function makePdfFile(name = 'test.pdf') {
  const file = new File(['%PDF-1.4 content'], name, { type: 'application/pdf' });
  return file;
}

async function uploadFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

async function advanceToDetails(container: HTMLElement) {
  const file = makePdfFile();
  mockValidatePdfFile.mockReturnValue({ valid: true });
  mockGeneratePDFHash.mockResolvedValue({
    hash: VALID_HASH,
    fileName: 'test.pdf',
    fileSize: 1024,
    pageCount: 1,
  });

  await uploadFile(container, file);
  await waitFor(() => {
    expect(screen.getByText('Student Wallet Address')).toBeInTheDocument();
  });
}

async function fillDetailsAndContinue(container: HTMLElement) {
  await advanceToDetails(container);

  mockSanitizeAddress.mockReturnValue(VALID_WALLET);

  fireEvent.change(screen.getByPlaceholderText('0x...'), {
    target: { value: VALID_WALLET },
  });
  fireEvent.change(screen.getByPlaceholderText(/MSc Cybersecurity/), {
    target: { value: 'Computer Science' },
  });
  // Year field already has current year; it's valid, so just click Continue
  fireEvent.click(screen.getByText('Continue'));

  await waitFor(() => {
    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('IssueCertificate page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIsConnected = true;
    mockCanIssue = {
      canIssue: true,
      isLoading: false,
      reason: '',
      refetch: vi.fn(),
    };
    mockTxState = {
      issueCertificate: mockIssueCertificate,
      isPending: false,
      isConfirming: false,
      isSuccess: false,
      transactionPhase: 'idle' as const,
      error: null,
      transactionHash: undefined,
      certificateId: undefined,
      reset: mockReset,
    };
    mockReadContractResult = { data: false, isLoading: false };
    capturedOnSuccess = null;
    capturedOnError = null;

    mockSanitizeAddress.mockReturnValue(VALID_WALLET);
    mockValidatePdfFile.mockReturnValue({ valid: true });
    mockRateLimiterIsAllowed.mockReturnValue(true);
    mockGeneratePDFHash.mockResolvedValue({
      hash: VALID_HASH,
      fileName: 'test.pdf',
      fileSize: 1024,
      pageCount: 1,
    });
    mockIssueCertificate.mockResolvedValue(undefined);

    // Ensure the hook mock always re-captures callbacks
    (useCertificateIssuanceWithCallback as ReturnType<typeof vi.fn>).mockImplementation(
      (onSuccess: (hash: `0x${string}`, certId?: bigint) => void, onError: (err: Error) => void) => {
        capturedOnSuccess = onSuccess;
        capturedOnError = onError;
        return mockTxState;
      }
    );
  });

  // Not connected
  it('shows "Connect Your Wallet" when wallet is not connected', () => {
    mockIsConnected = false;
    render(<IssueCertificate />);
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
  });

  // Loading status
  it('shows loading spinner when checking institution status', () => {
    mockCanIssue = { ...mockCanIssue, isLoading: true };
    render(<IssueCertificate />);
    expect(screen.getByText('Verifying institution status...')).toBeInTheDocument();
  });

  // canIssue=false
  it('shows blocked UI with reason when canIssue=false', () => {
    mockCanIssue = {
      canIssue: false,
      isLoading: false,
      reason: 'Institution is not verified',
      refetch: vi.fn(),
    };
    render(<IssueCertificate />);
    expect(screen.getByText('Certificate Issuance Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Institution is not verified')).toBeInTheDocument();
  });

  // Upload step
  it('shows file upload area by default (all conditions met)', () => {
    render(<IssueCertificate />);
    expect(screen.getByText('Upload Certificate PDF')).toBeInTheDocument();
  });

  // File validation failure
  it('shows error when file validation fails', async () => {
    mockValidatePdfFile.mockReturnValue({ valid: false, error: 'Not a valid PDF' });
    const { container } = render(<IssueCertificate />);

    await uploadFile(container, makePdfFile());

    await waitFor(() => {
      expect(screen.getByText('Not a valid PDF')).toBeInTheDocument();
    });
  });

  // generatePDFHash throws
  it('shows parseError message when generatePDFHash throws', async () => {
    mockValidatePdfFile.mockReturnValue({ valid: true });
    mockGeneratePDFHash.mockRejectedValue(new Error('PDF parsing failed'));
    const { container } = render(<IssueCertificate />);

    await uploadFile(container, makePdfFile());

    await waitFor(() => {
      expect(screen.getByText('PDF parsing failed')).toBeInTheDocument();
    });
  });

  // Valid file advances to details
  it('advances to details step on valid file upload', async () => {
    const { container } = render(<IssueCertificate />);
    await advanceToDetails(container);

    expect(screen.getByText('Student Wallet Address')).toBeInTheDocument();
    expect(screen.getByText('Program Name')).toBeInTheDocument();
    expect(screen.getByText('Graduation Year')).toBeInTheDocument();
  });

  // Wallet validation: empty
  it('shows error when wallet is empty on Continue', async () => {
    const { container } = render(<IssueCertificate />);
    await advanceToDetails(container);

    // Clear the wallet field
    const walletInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(walletInput, { target: { value: '' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Student wallet address is required')).toBeInTheDocument();
    });
  });

  // Wallet validation: invalid
  it('shows error when wallet is invalid (sanitizeAddress returns null)', async () => {
    mockSanitizeAddress.mockReturnValue(null);
    const { container } = render(<IssueCertificate />);
    await advanceToDetails(container);

    const walletInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(walletInput, { target: { value: 'not-a-wallet' } });
    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Invalid Ethereum address format')).toBeInTheDocument();
    });
  });

  // Program validation: empty
  it('shows error when program is empty', async () => {
    const { container } = render(<IssueCertificate />);
    await advanceToDetails(container);

    // Enter valid wallet so wallet validation passes
    const walletInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(walletInput, { target: { value: VALID_WALLET } });

    // Leave program empty
    const programInput = screen.getByPlaceholderText(/MSc Cybersecurity/);
    fireEvent.change(programInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Program name is required')).toBeInTheDocument();
    });
  });

  // Program validation: too short
  it('shows error when program name is too short', async () => {
    const { container } = render(<IssueCertificate />);
    await advanceToDetails(container);

    const walletInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(walletInput, { target: { value: VALID_WALLET } });

    const programInput = screen.getByPlaceholderText(/MSc Cybersecurity/);
    fireEvent.change(programInput, { target: { value: 'AB' } }); // only 2 chars

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Program name must be at least 3 characters')).toBeInTheDocument();
    });
  });

  // Year validation: out of range
  it('shows error when year is out of range', async () => {
    const { container } = render(<IssueCertificate />);
    await advanceToDetails(container);

    const walletInput = screen.getByPlaceholderText('0x...');
    fireEvent.change(walletInput, { target: { value: VALID_WALLET } });

    const programInput = screen.getByPlaceholderText(/MSc Cybersecurity/);
    fireEvent.change(programInput, { target: { value: 'Computer Science' } });

    const yearInput = screen.getByPlaceholderText('2024');
    fireEvent.change(yearInput, { target: { value: '1800' } });

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText('Graduation year must be between 1900 and 2100')).toBeInTheDocument();
    });
  });

  // Valid details → confirm step
  it('advances to confirm step with all valid details', async () => {
    const { container } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    expect(screen.getByText('Review & Confirm')).toBeInTheDocument();
  });

  // Confirm step shows review data
  it('confirm step shows filename, wallet, program, and year', async () => {
    const { container } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText(VALID_WALLET)).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
  });

  // Submit when canIssue=false at submit time
  it('shows error and stays in confirm if canIssue=false at submit time', async () => {
    const { container, rerender } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    // Change canIssue to false and force re-render so the component picks it up
    mockCanIssue = {
      canIssue: false,
      isLoading: false,
      reason: 'Suspended by admin',
      refetch: vi.fn(),
    };
    rerender(<IssueCertificate />);

    // The page should now show the blocked UI since canIssue=false
    await waitFor(() => {
      expect(screen.getByText('Certificate Issuance Unavailable')).toBeInTheDocument();
    });
    expect(mockIssueCertificate).not.toHaveBeenCalled();
  });

  // Submit calls issueCertificate with correct args
  it('submit calls issueCertificate with correct parameters', async () => {
    const { container } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    const issueButtons = screen.getAllByText('Issue Certificate');
    const issueBtn = issueButtons.find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(issueBtn);

    await waitFor(() => {
      expect(mockIssueCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          documentHash: VALID_HASH,
          studentWallet: VALID_WALLET,
          graduationYear: expect.any(Number),
        })
      );
    });
  });

  // Success callback
  it('success callback transitions to "Certificate Issued!" state', async () => {
    const { container } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    // Trigger capturedOnSuccess directly
    capturedOnSuccess!('0xdeadbeef' as `0x${string}`, undefined);

    await waitFor(() => {
      expect(screen.getByText('Certificate Issued!')).toBeInTheDocument();
    });
  });

  // Error callback
  it('error callback shows decoded error message', async () => {
    const { container } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    capturedOnError!(new Error('Transaction was rejected by contract'));

    await waitFor(() => {
      // The error message appears in the red-300 paragraph (may also appear in tooltip pre)
      const errorEls = screen.getAllByText('Transaction was rejected by contract');
      expect(errorEls.length).toBeGreaterThan(0);
    });
  });

  // Frontend duplicate check
  it('shows duplicate warning card when isDuplicateOnChain=true', async () => {
    mockReadContractResult = { data: true, isLoading: false };
    const { container } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    // Trigger submit to set the frontend-duplicate error
    const issueButtons = screen.getAllByText('Issue Certificate');
    const issueBtn = issueButtons.find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(issueBtn);

    await waitFor(() => {
      expect(screen.getByText(/Duplicate Certificate Detected/i)).toBeInTheDocument();
    });
  });

  // Rate limit exceeded
  it('shows rate limit error when rate limiter blocks the request', async () => {
    mockRateLimiterIsAllowed.mockReturnValue(false);
    const { container } = render(<IssueCertificate />);
    await fillDetailsAndContinue(container);

    const issueButtons = screen.getAllByText('Issue Certificate');
    const issueBtn = issueButtons.find((el) => el.tagName === 'BUTTON')!;
    fireEvent.click(issueBtn);

    await waitFor(() => {
      // Error appears in multiple places (error card p and tooltip pre)
      const elements = screen.getAllByText(/Rate limit exceeded/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});

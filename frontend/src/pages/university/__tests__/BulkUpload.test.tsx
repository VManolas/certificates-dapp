// src/pages/university/__tests__/BulkUpload.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { BulkCertificateEntry } from '@/lib/csvTemplate';

// ─── Hoist stable vi.fn() references ─────────────────────────────────────────
const {
  mockIssueCertificatesBatch,
  mockResetBatch,
  mockRefetchStatus,
  mockRefetchInstitution,
  mockDownloadCSVTemplate,
  mockParseCSV,
  mockMatchPDFsToEntries,
  mockGeneratePDFHash,
  mockReadContract,
} = vi.hoisted(() => ({
  mockIssueCertificatesBatch: vi.fn(),
  mockResetBatch: vi.fn(),
  mockRefetchStatus: vi.fn(),
  mockRefetchInstitution: vi.fn(),
  mockDownloadCSVTemplate: vi.fn(),
  mockParseCSV: vi.fn(),
  mockMatchPDFsToEntries: vi.fn(),
  mockGeneratePDFHash: vi.fn(),
  mockReadContract: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: mockIsConnected }),
}));

vi.mock('@wagmi/core', () => ({
  readContract: mockReadContract,
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    institutionData: mockInstitutionData,
    refetchInstitution: mockRefetchInstitution,
  }),
}));

vi.mock('@/hooks', () => ({
  useCanIssueCertificates: () => mockCanIssue,
}));

vi.mock('@/hooks/useBatchCertificateIssuance', () => ({
  useBatchCertificateIssuance: () => mockBatchState,
}));

vi.mock('@/lib/csvTemplate', () => ({
  downloadCSVTemplate: mockDownloadCSVTemplate,
  parseCSV: mockParseCSV,
  matchPDFsToEntries: mockMatchPDFsToEntries,
}));

vi.mock('@/lib/pdfHash', () => ({
  generatePDFHash: mockGeneratePDFHash,
}));

vi.mock('@/lib/wagmi', () => ({
  CERTIFICATE_REGISTRY_ADDRESS: '0xCertRegAddress',
  config: {},
}));

vi.mock('@/contracts/abis/CertificateRegistry.json', () => ({
  default: { abi: [] },
}));

vi.mock('@/lib/adminContact', () => ({
  withAdminContact: (msg: string) => `${msg} Contact admin.`,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Module-scope mutable state ───────────────────────────────────────────────
let mockIsConnected = true;

let mockInstitutionData: {
  name: string;
  isVerified: boolean;
  isActive: boolean;
} | null = {
  name: 'Test University',
  isVerified: true,
  isActive: true,
};

let mockCanIssue = {
  canIssue: true,
  isLoading: false,
  reason: '',
  refetch: mockRefetchStatus,
};

let mockBatchState = {
  issueCertificatesBatch: mockIssueCertificatesBatch,
  isPending: false,
  isConfirming: false,
  isSuccess: false,
  transactionPhase: null as 'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed' | null,
  error: null as string | null,
  transactionHash: undefined as string | undefined,
  certificateIds: [] as bigint[],
  reset: mockResetBatch,
};

// ─── Import after mocks ───────────────────────────────────────────────────────
import { BulkUpload } from '../BulkUpload';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const VALID_WALLET = '0x1234567890123456789012345678901234567890';
const VALID_HASH = '0xaabbccdd00000000000000000000000000000000000000000000000000000000';

// jsdom's File does not implement .text() — polyfill it globally for tests
if (!File.prototype.text) {
  File.prototype.text = function () {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(this);
    });
  };
}

function makeCSVFile(name = 'certificates.csv'): File {
  return new File(['student_wallet,student_name,program,graduation_year,pdf_filename\n'], name, {
    type: 'text/csv',
  });
}

function makePDFFile(name = 'cert.pdf'): File {
  return new File(['%PDF-1.4 content'], name, { type: 'application/pdf' });
}

function makeValidEntry(overrides: Partial<BulkCertificateEntry> = {}): BulkCertificateEntry {
  return {
    studentWallet: VALID_WALLET,
    studentName: 'Alice Smith',
    program: 'Computer Science',
    graduationYear: 2024,
    pdfFilename: 'cert.pdf',
    documentHash: VALID_HASH,
    pdfFile: makePDFFile(),
    validationErrors: [],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('BulkUpload page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockIsConnected = true;
    mockInstitutionData = { name: 'Test University', isVerified: true, isActive: true };
    mockCanIssue = { canIssue: true, isLoading: false, reason: '', refetch: mockRefetchStatus };
    mockBatchState = {
      issueCertificatesBatch: mockIssueCertificatesBatch,
      isPending: false,
      isConfirming: false,
      isSuccess: false,
      transactionPhase: null,
      error: null,
      transactionHash: undefined,
      certificateIds: [],
      reset: mockResetBatch,
    };

    mockIssueCertificatesBatch.mockResolvedValue(undefined);
    mockReadContract.mockResolvedValue(BigInt(0));
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH, pageCount: 1, fileSize: 1024, fileName: 'cert.pdf' });

    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  // ─── Guard conditions ─────────────────────────────────────────────────────

  it('shows "Connect Your Wallet" when wallet is not connected', () => {
    mockIsConnected = false;
    render(<BulkUpload />);
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(
      screen.getByText(/Please connect your wallet to access bulk certificate upload/i)
    ).toBeInTheDocument();
  });

  it('shows loading spinner when checking institution status', () => {
    mockCanIssue = { ...mockCanIssue, isLoading: true };
    render(<BulkUpload />);
    expect(screen.getByText('Verifying institution status...')).toBeInTheDocument();
  });

  it('shows blocked UI with reason when canIssue=false', () => {
    mockCanIssue = {
      canIssue: false,
      isLoading: false,
      reason: 'Institution is pending approval',
      refetch: mockRefetchStatus,
    };
    render(<BulkUpload />);
    expect(screen.getByText('Bulk Certificate Upload Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Institution is pending approval')).toBeInTheDocument();
  });

  it('shows "Refresh Status" button in blocked UI that calls refetch', () => {
    mockCanIssue = {
      canIssue: false,
      isLoading: false,
      reason: 'Not verified',
      refetch: mockRefetchStatus,
    };
    render(<BulkUpload />);
    fireEvent.click(screen.getByText('Refresh Status'));
    expect(mockRefetchStatus).toHaveBeenCalledTimes(1);
  });

  it('shows "Institution Not Active" when institutionData.isActive=false (canIssue=true)', () => {
    mockInstitutionData = { name: 'Test University', isVerified: true, isActive: false };
    render(<BulkUpload />);
    expect(screen.getByText('Institution Not Active')).toBeInTheDocument();
  });

  // ─── Upload step (happy path) ─────────────────────────────────────────────

  it('renders upload step with 3-step indicator when all conditions are met', () => {
    render(<BulkUpload />);
    expect(screen.getByText('Bulk Certificate Upload')).toBeInTheDocument();
    expect(screen.getByText('Upload Files')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Process')).toBeInTheDocument();
  });

  it('"Download Template" button calls downloadCSVTemplate', () => {
    render(<BulkUpload />);
    fireEvent.click(screen.getByText('Download Template'));
    expect(mockDownloadCSVTemplate).toHaveBeenCalledTimes(1);
  });

  it('CSV file upload shows filename confirmation below the input', () => {
    render(<BulkUpload />);
    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    const file = makeCSVFile('my-certs.csv');
    fireEvent.change(csvInput, { target: { files: [file] } });
    expect(screen.getByText(/my-certs\.csv uploaded/i)).toBeInTheDocument();
  });

  it('PDF file upload shows count summary', () => {
    render(<BulkUpload />);
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    const pdf = makePDFFile('cert.pdf');
    fireEvent.change(pdfInput, { target: { files: [pdf] } });
    expect(screen.getByText('1 PDF file(s) ready to process')).toBeInTheDocument();
  });

  it('"Continue to Preview" is disabled when no CSV and no PDFs', () => {
    render(<BulkUpload />);
    const btn = screen.getByText('Continue to Preview');
    expect(btn).toBeDisabled();
  });

  it('"Continue to Preview" is disabled when CSV is uploaded but no PDFs', () => {
    render(<BulkUpload />);
    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    expect(screen.getByText('Continue to Preview')).toBeDisabled();
  });

  it('"Continue to Preview" is enabled when both CSV and PDF are uploaded', () => {
    render(<BulkUpload />);
    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });
    expect(screen.getByText('Continue to Preview')).not.toBeDisabled();
  });

  // ─── processCSVAndMatch alert paths ──────────────────────────────────────

  it('alerts "CSV file has no data rows" when parseCSV returns empty array', async () => {
    mockParseCSV.mockReturnValue([]);
    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('CSV file has no data rows');
    });
  });

  it('alerts about max batch size when parseCSV returns more than 50 entries', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => makeValidEntry({ pdfFilename: `cert${i}.pdf` }));
    mockParseCSV.mockReturnValue(tooMany);
    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        'Maximum batch size is 50 certificates. Please split into smaller batches.'
      );
    });
  });

  // ─── Preview step ─────────────────────────────────────────────────────────

  it('transitions to preview step after successful CSV parse', async () => {
    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(screen.getByText('Preview Certificates')).toBeInTheDocument();
    });
  });

  it('preview shows valid count and student name', async () => {
    const entry = makeValidEntry({ studentName: 'Bob Jones' });
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    // Valid count: the accent-colored "Valid" count in the summary should be "1"
    const validCountEl = document.querySelector('.text-2xl.font-bold.text-accent-400');
    expect(validCountEl).toBeInTheDocument();
    expect(validCountEl?.textContent).toBe('1');
    // Valid badge (badge-success span) on the entry row
    const badgeEl = document.querySelector('.badge.badge-success');
    expect(badgeEl).toBeInTheDocument();
    expect(badgeEl?.textContent).toBe('Valid');
  });

  it('preview shows error badge for invalid entries', async () => {
    const entry = makeValidEntry({ validationErrors: ['Invalid wallet address format'] });
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
    expect(screen.getByText('Invalid wallet address format')).toBeInTheDocument();
  });

  it('"Back" button on preview returns to upload step', async () => {
    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(screen.getByText('Preview Certificates')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Download Template')).toBeInTheDocument();
    expect(screen.queryByText('Preview Certificates')).not.toBeInTheDocument();
  });

  // ─── Processing step ──────────────────────────────────────────────────────

  it('renders "Processing Certificates" heading when step is processing', async () => {
    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });
    mockReadContract.mockResolvedValue(BigInt(0));
    mockIssueCertificatesBatch.mockResolvedValue(undefined);

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(screen.getByText('Preview Certificates')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Start Processing/));

    await waitFor(() => {
      expect(screen.getByText('Processing Certificates')).toBeInTheDocument();
    });
  });

  // ─── Success state ────────────────────────────────────────────────────────

  it('renders "Batch Processing Complete!" when isSuccess=true', async () => {
    mockBatchState = {
      ...mockBatchState,
      isSuccess: true,
      certificateIds: [BigInt(1), BigInt(2)],
    };

    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });
    mockReadContract.mockResolvedValue(BigInt(0));

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(screen.getByText('Preview Certificates')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Start Processing/));

    await waitFor(() => {
      expect(screen.getByText('Batch Processing Complete!')).toBeInTheDocument();
    });
  });

  // ─── Error state ──────────────────────────────────────────────────────────

  it('renders "Transaction Failed" when batchError is set in processing step', async () => {
    mockBatchState = {
      ...mockBatchState,
      error: 'Transaction reverted',
    };

    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });
    mockReadContract.mockResolvedValue(BigInt(0));

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));

    await waitFor(() => {
      expect(screen.getByText('Preview Certificates')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Start Processing/));

    await waitFor(() => {
      expect(screen.getByText('Transaction Failed')).toBeInTheDocument();
    });
  });

  // ─── Reset / "Upload More" ────────────────────────────────────────────────

  it('"Upload More" button (after success) calls reset and returns to upload step', async () => {
    mockBatchState = {
      ...mockBatchState,
      isSuccess: true,
      certificateIds: [BigInt(1)],
    };

    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });
    mockReadContract.mockResolvedValue(BigInt(0));

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));
    await waitFor(() => screen.getByText('Preview Certificates'));

    fireEvent.click(screen.getByText(/Start Processing/));
    await waitFor(() => screen.getByText('Batch Processing Complete!'));

    fireEvent.click(screen.getByText('Upload More'));
    expect(mockResetBatch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Download Template')).toBeInTheDocument();
  });

  it('"Upload More" button (after error) calls reset and returns to upload step', async () => {
    mockBatchState = {
      ...mockBatchState,
      error: 'Something went wrong',
    };

    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });
    mockReadContract.mockResolvedValue(BigInt(0));

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));
    await waitFor(() => screen.getByText('Preview Certificates'));

    fireEvent.click(screen.getByText(/Start Processing/));
    await waitFor(() => screen.getByText('Transaction Failed'));

    fireEvent.click(screen.getByText('Upload More'));
    expect(mockResetBatch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Download Template')).toBeInTheDocument();
  });

  // ─── startBulkIssuance: calls issueCertificatesBatch with correct data ───────

  it('calls issueCertificatesBatch with correct batch data when Start Processing is clicked', async () => {
    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });
    mockReadContract.mockResolvedValue(BigInt(0));

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));
    await waitFor(() => screen.getByText('Preview Certificates'));

    fireEvent.click(screen.getByText(/Start Processing/));

    await waitFor(() => {
      expect(mockIssueCertificatesBatch).toHaveBeenCalledTimes(1);
    });

    const batchData = mockIssueCertificatesBatch.mock.calls[0][0];
    expect(Array.isArray(batchData)).toBe(true);
    expect(batchData[0]).toMatchObject({
      documentHash: VALID_HASH,
      studentWallet: VALID_WALLET,
      graduationYear: 2024,
    });
  });

  // ─── Transaction phase status banners ────────────────────────────────────

  it('shows "Waiting to submit transaction" banner when phase is awaiting_wallet_confirmation', async () => {
    mockBatchState = {
      ...mockBatchState,
      isPending: true,
      transactionPhase: 'awaiting_wallet_confirmation',
    };

    const entry = makeValidEntry();
    mockParseCSV.mockReturnValue([entry]);
    mockMatchPDFsToEntries.mockReturnValue([entry]);
    mockGeneratePDFHash.mockResolvedValue({ hash: VALID_HASH });
    mockReadContract.mockResolvedValue(BigInt(0));

    render(<BulkUpload />);

    const csvInput = document.querySelector('input[accept=".csv"]') as HTMLInputElement;
    fireEvent.change(csvInput, { target: { files: [makeCSVFile()] } });
    const pdfInput = document.querySelector('input[accept=".pdf"]') as HTMLInputElement;
    fireEvent.change(pdfInput, { target: { files: [makePDFFile()] } });

    fireEvent.click(screen.getByText('Continue to Preview'));
    await waitFor(() => screen.getByText('Preview Certificates'));

    fireEvent.click(screen.getByText(/Start Processing/));

    await waitFor(() => {
      expect(screen.getByText('Waiting to submit transaction')).toBeInTheDocument();
    });
  });
});

// src/pages/employer/__tests__/BatchVerify.test.tsx
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchVerify } from '@/pages/employer/BatchVerify';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUseAccount = vi.fn();
let mockStudentCerts: { certificateIds: bigint[] | undefined; isLoading: boolean } = {
  certificateIds: undefined,
  isLoading: false,
};
const mockUseStudentCertificates = vi.fn(() => mockStudentCerts);

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
}));

// Real-enough isAddress: 0x + exactly 40 hex chars
vi.mock('viem', () => ({
  isAddress: (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr),
}));

vi.mock('@/hooks', () => ({
  useStudentCertificates: (...args: unknown[]) => mockUseStudentCertificates(...args),
}));

vi.mock('@/lib/pdfHash', () => ({
  truncateHash: (hash: string, _pre: number, _suf: number) => hash.slice(0, 10) + '...' + hash.slice(-8),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>{children}</a>
  ),
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const WALLET1 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const WALLET2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const BATCH_KEY = 'zkcredentials-employer-batch-results';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderConnected() {
  return render(<BatchVerify />);
}

describe('BatchVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockUseAccount.mockReturnValue({ isConnected: true });
    mockStudentCerts = { certificateIds: undefined, isLoading: true };
    mockUseStudentCertificates.mockImplementation(() => mockStudentCerts);

    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Not-connected guard ──────────────────────────────────────────────────

  it('renders a connect-wallet prompt when the wallet is not connected', () => {
    mockUseAccount.mockReturnValue({ isConnected: false });
    render(<BatchVerify />);
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.queryByText('Batch Verification')).not.toBeInTheDocument();
  });

  // ─── Input section ────────────────────────────────────────────────────────

  it('renders the input section and header when connected', () => {
    renderConnected();
    expect(screen.getByText('Batch Verification')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/0x1234/)).toBeInTheDocument();
    expect(screen.getByText('Parse & Preview')).toBeInTheDocument();
  });

  it('shows the count of valid addresses detected in real time', async () => {
    renderConnected();
    const textarea = screen.getByPlaceholderText(/0x1234/);

    fireEvent.change(textarea, { target: { value: WALLET1 } });
    await waitFor(() => {
      expect(screen.getByText('1 valid addresses detected')).toBeInTheDocument();
    });
  });

  it('Parse & Preview button is disabled with an empty textarea', () => {
    renderConnected();
    expect(screen.getByText('Parse & Preview')).toBeDisabled();
  });

  it('Parse & Preview button is disabled when the text contains no valid addresses', async () => {
    renderConnected();
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: 'not-an-address' } });
    await waitFor(() => {
      expect(screen.getByText('Parse & Preview')).toBeDisabled();
    });
  });

  it('parses comma-separated addresses the same as newline-separated ones', async () => {
    renderConnected();
    // Enter two valid addresses separated by a comma (not a newline)
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), {
      target: { value: `${WALLET1},${WALLET2}` },
    });

    await waitFor(() => {
      expect(screen.getByText('2 valid addresses detected')).toBeInTheDocument();
    });
  });

  it('alerts when more than 100 addresses are provided', () => {
    renderConnected();

    // Build 101 unique valid-looking addresses
    const addresses = Array.from({ length: 101 }, (_, i) =>
      `0x${i.toString(16).padStart(40, '0')}`,
    ).join('\n');

    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: addresses } });

    const btn = screen.getByText('Parse & Preview');
    btn.removeAttribute('disabled');
    fireEvent.click(btn);

    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Maximum 100 addresses'),
    );
  });

  // ─── Preview section ──────────────────────────────────────────────────────

  it('shows the entries table after a valid parse', async () => {
    renderConnected();
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: WALLET1 } });
    fireEvent.click(screen.getByText('Parse & Preview'));

    await waitFor(() => {
      expect(screen.getByText('Wallet Address')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('deduplicates addresses in the CSV input', async () => {
    renderConnected();
    // WALLET1 entered twice
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), {
      target: { value: `${WALLET1}\n${WALLET1}\n${WALLET2}` },
    });
    fireEvent.click(screen.getByText('Parse & Preview'));

    await waitFor(() => {
      // Should show 2 entries (not 3)
      const pending = screen.getAllByText('Pending');
      expect(pending).toHaveLength(2);
    });
  });

  it('shows Start Verification and Reset buttons after parse', async () => {
    renderConnected();
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: WALLET1 } });
    fireEvent.click(screen.getByText('Parse & Preview'));

    await waitFor(() => {
      expect(screen.getByText('Start Verification')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });
  });

  it('shows a progress bar with 0 / N before verification starts', async () => {
    renderConnected();
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: WALLET1 } });
    fireEvent.click(screen.getByText('Parse & Preview'));

    await waitFor(() => {
      expect(screen.getByText('0 / 1')).toBeInTheDocument();
      expect(screen.getByText('Ready to verify')).toBeInTheDocument();
    });
  });

  // ─── Reset ────────────────────────────────────────────────────────────────

  it('Reset clears entries and returns to the input screen', async () => {
    renderConnected();
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: WALLET1 } });
    fireEvent.click(screen.getByText('Parse & Preview'));

    await waitFor(() => expect(screen.getByText('Reset')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/0x1234/)).toBeInTheDocument();
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });
  });

  it('Reset removes batch data from sessionStorage', async () => {
    sessionStorage.setItem(BATCH_KEY, JSON.stringify({ csvText: 'x', entries: [], isProcessing: false, currentIndex: 0 }));
    renderConnected();
    // Trigger a parse so there are entries (needed to see Reset button)
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: WALLET1 } });
    fireEvent.click(screen.getByText('Parse & Preview'));

    await waitFor(() => expect(screen.getByText('Reset')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(sessionStorage.getItem(BATCH_KEY)).toBeNull();
    });
  });

  // ─── sessionStorage restore ───────────────────────────────────────────────

  it('restores new-format state from sessionStorage on mount', async () => {
    const state = {
      csvText: WALLET1,
      entries: [{ id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'pending' }],
      isProcessing: false,
      currentIndex: 0,
    };
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));

    renderConnected();

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('restores legacy array-format state from sessionStorage on mount', async () => {
    const legacyState = [
      { id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'completed', certificateCount: 3 },
    ];
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(legacyState));

    renderConnected();

    await waitFor(() => {
      expect(screen.getByText('Has Certs')).toBeInTheDocument();
    });
  });

  it('ignores malformed sessionStorage data and shows a clean input screen', () => {
    sessionStorage.setItem(BATCH_KEY, 'not-valid-json{');
    renderConnected();
    expect(screen.getByPlaceholderText(/0x1234/)).toBeInTheDocument();
  });

  // ─── Export Results ───────────────────────────────────────────────────────

  it('Export Results triggers a CSV download', async () => {
    const state = {
      csvText: WALLET1,
      entries: [{ id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'completed', certificateCount: 2 }],
      isProcessing: false,
      currentIndex: 0,
    };
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));

    renderConnected();

    await waitFor(() => expect(screen.getByText('Export Results (CSV)')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Export Results (CSV)'));

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  // ─── BatchEntryRow status rendering ──────────────────────────────────────

  it('BatchEntryRow renders Pending badge for a pending entry', async () => {
    const state = {
      csvText: WALLET1,
      entries: [{ id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'pending' }],
      isProcessing: false,
      currentIndex: 0,
    };
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));

    renderConnected();
    await waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument());
  });

  it('BatchEntryRow renders Checking badge when the row is active (isProcessing + index match)', async () => {
    // Start with pending entries and trigger "Start Verification" → first row becomes active
    renderConnected();
    fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: WALLET1 } });
    fireEvent.click(screen.getByText('Parse & Preview'));

    await waitFor(() => expect(screen.getByText('Start Verification')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Start Verification'));

    // The first row is now active; loading=true prevents onComplete so we stay in Checking
    await waitFor(() => {
      expect(screen.getByText('Checking')).toBeInTheDocument();
    });
  });

  it('BatchEntryRow renders Has Certs badge and cert count for a completed entry', async () => {
    const state = {
      csvText: WALLET1,
      entries: [{ id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'completed', certificateCount: 5 }],
      isProcessing: false,
      currentIndex: 0,
    };
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));

    renderConnected();
    await waitFor(() => {
      expect(screen.getByText('Has Certs')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('BatchEntryRow renders No Certs badge when certificateCount is 0', async () => {
    const state = {
      csvText: WALLET1,
      entries: [{ id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'completed', certificateCount: 0 }],
      isProcessing: false,
      currentIndex: 0,
    };
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));

    renderConnected();
    await waitFor(() => expect(screen.getByText('No Certs')).toBeInTheDocument());
  });

  it('BatchEntryRow renders a View Details link for completed entries with certificates', async () => {
    const state = {
      csvText: WALLET1,
      entries: [{ id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'completed', certificateCount: 2 }],
      isProcessing: false,
      currentIndex: 0,
    };
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));

    renderConnected();
    await waitFor(() => {
      const link = screen.getByText('View Details →');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute('href', expect.stringContaining(WALLET1));
    });
  });

  it('BatchEntryRow does not render a View Details link when certificateCount is 0', async () => {
    const state = {
      csvText: WALLET1,
      entries: [{ id: '0-' + WALLET1, walletAddress: WALLET1, isValid: true, status: 'completed', certificateCount: 0 }],
      isProcessing: false,
      currentIndex: 0,
    };
    sessionStorage.setItem(BATCH_KEY, JSON.stringify(state));

    renderConnected();
    await waitFor(() => expect(screen.getByText('No Certs')).toBeInTheDocument());
    expect(screen.queryByText('View Details →')).not.toBeInTheDocument();
  });

  // ─── Full verification flow ───────────────────────────────────────────────

  it('completes an entry and shows Export Results when verification finishes', async () => {
    vi.useFakeTimers();
    mockStudentCerts = { certificateIds: [1n, 2n], isLoading: false };
    mockUseStudentCertificates.mockImplementation(() => mockStudentCerts);

    renderConnected();

    // Parse and start — these are synchronous state updates; wrap in act to flush renders
    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText(/0x1234/), { target: { value: WALLET1 } });
      fireEvent.click(screen.getByText('Parse & Preview'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Verification'));
    });

    // BatchEntryRow schedules onComplete via setTimeout(0) during the active render.
    // Advance fake timers so it fires, then flush the resulting React state update.
    await act(async () => {
      vi.runAllTimers();
    });

    // No waitFor — state is synchronously flushed by act above.
    expect(screen.getByText('Has Certs')).toBeInTheDocument();
    expect(screen.getByText('Export Results (CSV)')).toBeInTheDocument();

    vi.useRealTimers();
  });
});

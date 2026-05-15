// src/components/__tests__/ShareCertificateModal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareCertificateModal } from '../ShareCertificateModal';
import type { Certificate, PrivacySettings } from '@/types/certificate';

// ─── Hoist stable vi.fn() references ─────────────────────────────────────────
const { mockGenerateQRCodePayload } = vi.hoisted(() => ({
  mockGenerateQRCodePayload: vi.fn(),
}));

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('qrcode.react', () => ({
  QRCodeSVG: () => <div data-testid="qr-svg" />,
}));

vi.mock('@/components/PrivacyControlModal', () => ({
  PrivacyControlModal: ({
    isOpen,
    onConfirm,
    onClose,
  }: {
    isOpen: boolean;
    onConfirm: (s: PrivacySettings) => void;
    onClose: () => void;
    defaultSettings?: PrivacySettings;
  }) =>
    isOpen ? (
      <div data-testid="privacy-modal">
        <button onClick={() => onConfirm({ includeWallet: true, includeInitials: false })}>
          Confirm Privacy
        </button>
        <button onClick={onClose}>Cancel Privacy</button>
      </div>
    ) : null,
}));

vi.mock('@/lib/qrCode', () => ({
  generateQRCodePayload: mockGenerateQRCodePayload,
  getQRCodeSize: vi.fn(() => 200),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────
const testPayload = {
  program: 'Computer Science',
  university: 'Test University',
  graduationYear: 2025,
  status: 'Verified' as const,
  documentHash: '0xabc',
  version: '1.0',
  generatedAt: 1700000000000,
};

function makeQRPayload(): string {
  return 'V1:' + btoa(JSON.stringify(testPayload));
}

const testCert: Partial<Certificate> = {
  documentHash: '0xabc123',
  metadataURI: JSON.stringify({ program: 'Computer Science' }),
  graduationYear: 2025,
  isRevoked: false,
  studentWallet: '0x1234567890123456789012345678901234567890',
};

const defaultProps = {
  certificate: testCert,
  universityName: 'Test University',
  isOpen: true,
  onClose: vi.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('ShareCertificateModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateQRCodePayload.mockReturnValue(makeQRPayload());

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('renders null when isOpen=false', () => {
    const { container } = render(
      <ShareCertificateModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows modal header "Share Certificate" when isOpen=true', () => {
    render(<ShareCertificateModal {...defaultProps} />);
    expect(screen.getByText('Share Certificate')).toBeInTheDocument();
  });

  it('automatically opens PrivacyControlModal on mount when no QR data', async () => {
    render(<ShareCertificateModal {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByTestId('privacy-modal')).toBeInTheDocument();
    });
  });

  it('after confirming privacy settings, hides PrivacyControlModal and shows QR', async () => {
    render(<ShareCertificateModal {...defaultProps} />);

    await waitFor(() => screen.getByText('Confirm Privacy'));
    fireEvent.click(screen.getByText('Confirm Privacy'));

    await waitFor(() => {
      expect(screen.queryByTestId('privacy-modal')).not.toBeInTheDocument();
      expect(screen.getByTestId('qr-svg')).toBeInTheDocument();
    });
  });

  it('shows shared info section after QR is confirmed', async () => {
    render(<ShareCertificateModal {...defaultProps} />);
    await waitFor(() => screen.getByText('Confirm Privacy'));
    fireEvent.click(screen.getByText('Confirm Privacy'));

    await waitFor(() => {
      expect(screen.getByText('Shared Information')).toBeInTheDocument();
      expect(screen.getByText('Computer Science')).toBeInTheDocument();
      expect(screen.getByText('Test University')).toBeInTheDocument();
      expect(screen.getByText('2025')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  it('shows privacy settings display after QR confirmed (Wallet included, Initials hidden)', async () => {
    render(<ShareCertificateModal {...defaultProps} />);
    await waitFor(() => screen.getByText('Confirm Privacy'));
    fireEvent.click(screen.getByText('Confirm Privacy'));

    await waitFor(() => {
      expect(screen.getByText('Wallet: ✓ Included')).toBeInTheDocument();
      expect(screen.getByText('Initials: ✗ Hidden')).toBeInTheDocument();
    });
  });

  it('"Copy" button writes QR code data to clipboard and shows "Copied to clipboard!"', async () => {
    render(<ShareCertificateModal {...defaultProps} />);
    await waitFor(() => screen.getByText('Confirm Privacy'));
    fireEvent.click(screen.getByText('Confirm Privacy'));

    await waitFor(() => screen.getByTestId('qr-svg'));

    // Find the copy button (SVG inside it, or we locate it by its adjacent element)
    const allButtons = screen.getAllByRole('button');
    const copyBtn = allButtons.find(
      (btn) => btn.textContent === '' && btn.closest('.flex.gap-2')
    );
    // Alternatively click the button inside the flex row with the input
    const inputEl = screen.getByDisplayValue(/V1:/) as HTMLInputElement;
    const flexRow = inputEl.parentElement!;
    const copyButton = flexRow.querySelector('button')!;
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(makeQRPayload());
      expect(screen.getByText('Copied to clipboard!')).toBeInTheDocument();
    });
  });

  it('"Change" button re-opens PrivacyControlModal', async () => {
    render(<ShareCertificateModal {...defaultProps} />);
    await waitFor(() => screen.getByText('Confirm Privacy'));
    fireEvent.click(screen.getByText('Confirm Privacy'));

    await waitFor(() => screen.getByText('Change'));
    fireEvent.click(screen.getByText('Change'));

    await waitFor(() => {
      expect(screen.getByTestId('privacy-modal')).toBeInTheDocument();
    });
  });

  it('close (X) button calls onClose', () => {
    const onClose = vi.fn();
    render(<ShareCertificateModal {...defaultProps} onClose={onClose} />);

    // Use getAllByLabelText since there may be multiple elements with aria-label="Close"
    const closeButtons = screen.getAllByLabelText('Close');
    fireEvent.click(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('canceling PrivacyControlModal before QR generated calls onClose', async () => {
    const onClose = vi.fn();
    render(<ShareCertificateModal {...defaultProps} onClose={onClose} />);

    // Privacy modal is open because no QR yet (triggered by useEffect)
    await waitFor(() => screen.getByText('Cancel Privacy'));
    fireEvent.click(screen.getByText('Cancel Privacy'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('canceling PrivacyControlModal after QR generated does NOT call onClose', async () => {
    const onClose = vi.fn();
    render(<ShareCertificateModal {...defaultProps} onClose={onClose} />);

    // Confirm once to generate QR
    await waitFor(() => screen.getByText('Confirm Privacy'));
    fireEvent.click(screen.getByText('Confirm Privacy'));
    await waitFor(() => screen.getByText('Change'));

    // Re-open via Change
    fireEvent.click(screen.getByText('Change'));
    await waitFor(() => screen.getByTestId('privacy-modal'));

    // Cancel from the second time
    fireEvent.click(screen.getByText('Cancel Privacy'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closing modal (isOpen=false) resets state: next open re-shows privacy modal', async () => {
    const { rerender } = render(<ShareCertificateModal {...defaultProps} />);

    // Confirm privacy to get QR
    await waitFor(() => screen.getByText('Confirm Privacy'));
    fireEvent.click(screen.getByText('Confirm Privacy'));
    await waitFor(() => screen.getByTestId('qr-svg'));

    // Close the modal
    rerender(<ShareCertificateModal {...defaultProps} isOpen={false} />);

    // Re-open
    rerender(<ShareCertificateModal {...defaultProps} isOpen={true} />);

    // Privacy modal should show again since state was reset
    await waitFor(() => {
      expect(screen.getByTestId('privacy-modal')).toBeInTheDocument();
    });
  });
});

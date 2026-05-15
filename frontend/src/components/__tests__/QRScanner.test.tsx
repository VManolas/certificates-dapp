import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QRScanner } from '@/components/QRScanner';

const mockNavigate = vi.fn();
const mockOnClose = vi.fn();
const mockDecodeQRCodePayload = vi.fn();
const mockVerifyVerificationToken = vi.fn();

let mockVerificationState: {
  isValid: boolean;
  isRevoked: boolean;
  isLoading: boolean;
  error: Error | null;
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: () => <div data-testid="camera-scanner" />,
}));

vi.mock('jsqr', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/qrCode', () => ({
  decodeQRCodePayload: (...args: unknown[]) => mockDecodeQRCodePayload(...args),
}));

vi.mock('@/lib/verificationToken', () => ({
  verifyVerificationToken: (...args: unknown[]) => mockVerifyVerificationToken(...args),
}));

vi.mock('@/hooks/useCertificateVerification', () => ({
  useCertificateVerification: () => mockVerificationState,
}));

describe('QRScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVerificationState = {
      isValid: true,
      isRevoked: false,
      isLoading: false,
      error: null,
    };
  });

  it('navigates to secure token verification links', async () => {
    mockVerifyVerificationToken.mockReturnValue({
      valid: true,
      payload: { h: '0xabc' },
      signer: '0x1111111111111111111111111111111111111111',
    });

    render(<QRScanner onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText('https://... or V1:...'), {
      target: {
        value: 'https://example.com/verify?v=v1.token',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(mockVerifyVerificationToken).toHaveBeenCalledWith('v1.token');
      expect(mockNavigate).toHaveBeenCalledWith('/verify?v=v1.token');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates to hash verification links', async () => {
    render(<QRScanner onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText('https://... or V1:...'), {
      target: {
        value: 'https://example.com/verify?hash=0xabc123',
      },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Verify' }).closest('form')!);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/verify?hash=0xabc123');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('rejects legacy certificate-id links', async () => {
    render(<QRScanner onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText('https://... or V1:...'), {
      target: {
        value: 'https://example.com/verify?cert=123',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByText('Legacy certificate-ID links are no longer supported. Please request a new secure verification link.')
    ).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows token validation errors', async () => {
    mockVerifyVerificationToken.mockReturnValue({
      valid: false,
      reason: 'Verification link has expired',
    });

    render(<QRScanner onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText('https://... or V1:...'), {
      target: {
        value: 'https://example.com/verify?v=v1.expired',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Verification link has expired')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('decodes V1 payloads and renders verified certificate details', async () => {
    mockDecodeQRCodePayload.mockReturnValue({
      program: 'Computer Science',
      university: 'MIT',
      graduationYear: 2025,
      status: 'Verified',
      documentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      version: '1.0',
      generatedAt: new Date('2026-05-14T10:00:00.000Z').getTime(),
      studentWallet: '0x1111111111111111111111111111111111111111',
      studentInitials: 'AB',
    });

    render(<QRScanner onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText('https://... or V1:...'), {
      target: {
        value: 'V1:payload',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Certificate Verified ✓')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.getByText(/0x1111...1111/)).toBeInTheDocument();
  });

  it('shows payload decode errors for invalid V1 data', async () => {
    mockDecodeQRCodePayload.mockImplementation(() => {
      throw new Error('bad payload');
    });

    render(<QRScanner onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText('https://... or V1:...'), {
      target: {
        value: 'V1:bad',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByText('Invalid certificate QR code. The data could not be decoded.')
    ).toBeInTheDocument();
  });
});

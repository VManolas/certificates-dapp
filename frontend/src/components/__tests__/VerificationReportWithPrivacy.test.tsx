import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerificationReportWithPrivacy } from '@/components/VerificationReportWithPrivacy';

const mockCreateSignedVerificationToken = vi.fn();
const mockWarn = vi.fn();
const mockSignMessage = vi.fn();

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x1111111111111111111111111111111111111111' }),
  useChainId: () => 300,
}));

vi.mock('ethers', () => ({
  ethers: {
    providers: {
      Web3Provider: class {
        getSigner() {
          return {
            signMessage: mockSignMessage,
          };
        }
      },
    },
  },
}));

vi.mock('@/lib/verificationToken', () => ({
  createSignedVerificationToken: (...args: unknown[]) => mockCreateSignedVerificationToken(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mockWarn(...args),
  },
}));

vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }: { children: (args: { loading: boolean; url: string }) => React.ReactNode }) =>
    children({ loading: false, url: 'blob:report-url' }),
}));

vi.mock('@/components/VerificationReportPDF', () => ({
  VerificationReportPDF: (props: Record<string, unknown>) => (
    <div data-testid="verification-report-pdf">{JSON.stringify(props)}</div>
  ),
}));

vi.mock('@/components/PrivacyControlModal', () => ({
  PrivacyControlModal: ({
    isOpen,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (settings: {
      includeWallet: boolean;
      includeInitials: boolean;
      initials?: string;
    }) => void;
  }) =>
    isOpen ? (
      <div>
        <button onClick={onClose}>Close Modal</button>
        <button
          onClick={() =>
            onConfirm({
              includeWallet: true,
              includeInitials: true,
              initials: 'AB',
            })
          }
        >
          Confirm Privacy
        </button>
      </div>
    ) : null,
}));

describe('VerificationReportWithPrivacy', () => {
  const originalEthereum = (window as Window & { ethereum?: unknown }).ethereum;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let removeChildSpy: ReturnType<typeof vi.spyOn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSignedVerificationToken.mockResolvedValue('v1.signed-token');
    mockSignMessage.mockResolvedValue('signature');
    (window as Window & { ethereum?: unknown }).ethereum = {};

    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    removeChildSpy = vi.spyOn(document.body, 'removeChild');
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    (window as Window & { ethereum?: unknown }).ethereum = originalEthereum;
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  function renderComponent() {
    return render(
      <VerificationReportWithPrivacy
        certificateId={1n}
        documentHash="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        studentWallet="0x2222222222222222222222222222222222222222"
        institutionAddress="0x3333333333333333333333333333333333333333"
        issueDate={1n}
        isValid
        isRevoked={false}
        universityName="MIT"
        programName="Computer Science"
      />
    );
  }

  it('opens the privacy modal and generates a signed verification token', async () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Privacy' }));

    await waitFor(() =>
      expect(mockCreateSignedVerificationToken).toHaveBeenCalledWith(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0x1111111111111111111111111111111111111111',
        expect.any(Function)
      )
    );

    await waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });

  it('falls back to hash links when token generation fails', async () => {
    mockCreateSignedVerificationToken.mockRejectedValue(new Error('wallet rejected'));
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /Download Report/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Privacy' }));

    await waitFor(() => {
      expect(mockWarn).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });
  });
});

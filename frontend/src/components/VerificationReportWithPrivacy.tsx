// src/components/VerificationReportWithPrivacy.tsx
import { useState, useEffect, useRef } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { VerificationReportPDF } from './VerificationReportPDF';
import { PrivacyControlModal } from './PrivacyControlModal';
import { useAccount, useChainId } from 'wagmi';
import { ethers } from 'ethers';
import type { PrivacySettings } from '@/types/certificate';
import { createSignedVerificationToken } from '@/lib/verificationToken';
import { logger } from '@/lib/logger';

interface VerificationReportWithPrivacyProps {
  certificateId: bigint;
  documentHash: string;
  studentWallet: string;
  institutionAddress: string;
  issueDate: bigint;
  isValid: boolean;
  isRevoked: boolean;
  universityName?: string;
  programName?: string;
}

export function VerificationReportWithPrivacy({
  certificateId,
  documentHash,
  studentWallet,
  institutionAddress,
  issueDate,
  isValid,
  isRevoked,
  universityName,
  programName,
}: VerificationReportWithPrivacyProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    includeWallet: false,
    includeInitials: false,
  });
  const [shouldGeneratePDF, setShouldGeneratePDF] = useState(false);
  const downloadLinkRef = useRef<HTMLSpanElement>(null);

  const buildVerificationUrl = (query: string) => `${window.location.origin}/verify?${query}`;
  const normalizeVerificationUrl = (url: string) => url.replace('/veri-fy?', '/verify?');

  const [verificationUrl, setVerificationUrl] = useState(
    normalizeVerificationUrl(buildVerificationUrl(`hash=${documentHash}`))
  );
  const issueDateTime = new Date(Number(issueDate) * 1000);
  
  const handlePrivacyConfirm = async (settings: PrivacySettings) => {
    console.log('🔐 Privacy settings confirmed for report:', settings);
    console.log('📄 Original studentWallet:', studentWallet);
    console.log('📄 Will include wallet?', settings.includeWallet);
    console.log('📄 Wallet to pass:', settings.includeWallet ? studentWallet : undefined);
    console.log('📄 Will include initials?', settings.includeInitials);
    console.log('📄 Initials to pass:', settings.includeInitials ? settings.initials : undefined);
    
    setPrivacySettings(settings);
    setShowPrivacyModal(false);

    try {
      if (address && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        const token = await createSignedVerificationToken(
          documentHash as `0x${string}`,
          address as `0x${string}`,
          (message) => signer.signMessage(message)
        );
        setVerificationUrl(
          normalizeVerificationUrl(buildVerificationUrl(`v=${encodeURIComponent(token)}`))
        );
      } else {
        setVerificationUrl(
          normalizeVerificationUrl(buildVerificationUrl(`hash=${documentHash}`))
        );
      }
    } catch (error) {
      // Fallback keeps compatibility if signature is declined.
      logger.warn('Failed to generate signed verification token; falling back to hash link', {
        error,
      });
      setVerificationUrl(
        normalizeVerificationUrl(buildVerificationUrl(`hash=${documentHash}`))
      );
    }

    setShouldGeneratePDF(true);
  };

  // Trigger download when privacy settings are confirmed
  useEffect(() => {
    if (shouldGeneratePDF && downloadLinkRef.current) {
      // Small delay to ensure PDF is ready
      setTimeout(() => {
        const url = downloadLinkRef.current?.getAttribute('data-url');
        const filename = downloadLinkRef.current?.getAttribute('data-filename');
        
        if (url && url !== '#') {
          // Create temporary link and trigger download
          const link = document.createElement('a');
          link.href = url;
          link.download = filename || getFileName();
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        setShouldGeneratePDF(false);
      }, 100);
    }
  }, [shouldGeneratePDF]);

  const handleButtonClick = () => {
    // Always show privacy modal when button is clicked
    setShowPrivacyModal(true);
  };

  const getFileName = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    return `certificate-${certificateId.toString()}-verification-report-${timestamp}.pdf`;
  };

  return (
    <>
      {/* Visible Download button */}
      <button
        onClick={handleButtonClick}
        className="btn-secondary flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download Report
      </button>

      {/* Hidden PDFDownloadLink that gets triggered programmatically */}
      <div style={{ display: 'none' }}>
        <PDFDownloadLink
          document={
            <VerificationReportPDF
              certificateId={certificateId.toString()}
              documentHash={documentHash}
              studentWallet={privacySettings.includeWallet ? studentWallet : undefined}
              studentInitials={privacySettings.includeInitials ? privacySettings.initials : undefined}
              institutionAddress={institutionAddress}
              issueDate={issueDateTime}
              isValid={isValid}
              isRevoked={isRevoked}
              chainId={chainId}
              verificationUrl={normalizeVerificationUrl(verificationUrl)}
              universityName={universityName}
              programName={programName}
            />
          }
          fileName={getFileName()}
        >
          {({ loading, url }) => (
            // Use span instead of <a> to avoid nesting, then use ref to programmatically download
            <span 
              ref={downloadLinkRef as any}
              data-url={url || '#'}
              data-filename={getFileName()}
              style={{ display: loading ? 'none' : 'block' }}
            >
              Download
            </span>
          )}
        </PDFDownloadLink>
      </div>

      {/* Privacy Control Modal */}
      <PrivacyControlModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onConfirm={handlePrivacyConfirm}
        defaultSettings={privacySettings}
        actionLabel="Download Report"
        description="Choose what information to include in the verification report"
      />
    </>
  );
}

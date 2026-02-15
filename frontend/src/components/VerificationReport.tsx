// src/components/VerificationReport.tsx
import { VerificationReportWithPrivacy } from './VerificationReportWithPrivacy';
import { useIsInstitution } from '@/hooks/useInstitutionRegistry';
import { useCertificateDetails } from '@/hooks';

interface VerificationReportProps {
  certificateId: bigint;
  documentHash: string;
  studentWallet: string;
  institutionAddress: string;
  issueDate: bigint;
  isValid: boolean;
  isRevoked: boolean;
}

/**
 * VerificationReport Component
 * 
 * Displays a privacy-controlled verification report download button.
 * Fetches university name and program name from blockchain/certificate data.
 */
export function VerificationReport({
  certificateId,
  documentHash,
  studentWallet,
  institutionAddress,
  issueDate,
  isValid,
  isRevoked,
}: VerificationReportProps) {
  // Fetch university name from institution registry
  const { institutionData } = useIsInstitution(institutionAddress as `0x${string}`);
  const universityName = institutionData?.name || `Institution ${institutionAddress.slice(0, 6)}`;
  
  // Fetch certificate details to get program name from metadata
  const { certificate } = useCertificateDetails(certificateId, true);
  
  let programName = 'Unknown Program';
  if (certificate?.metadataURI) {
    try {
      const metadata = JSON.parse(certificate.metadataURI);
      programName = metadata.program || certificate.metadataURI;
    } catch {
      programName = certificate.metadataURI;
    }
  }

  return (
    <VerificationReportWithPrivacy
      certificateId={certificateId}
      documentHash={documentHash}
      studentWallet={studentWallet}
      institutionAddress={institutionAddress}
      issueDate={issueDate}
      isValid={isValid}
      isRevoked={isRevoked}
      universityName={universityName}
      programName={programName}
    />
  );
}

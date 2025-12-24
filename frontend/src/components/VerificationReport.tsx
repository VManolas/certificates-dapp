// src/components/VerificationReport.tsx
import { PDFDownloadLink } from '@react-pdf/renderer';
import { VerificationReportPDF } from './VerificationReportPDF';
import { useChainId } from 'wagmi';

interface VerificationReportProps {
  certificateId: bigint;
  documentHash: string;
  studentWallet: string;
  institutionAddress: string;
  issueDate: bigint;
  isValid: boolean;
  isRevoked: boolean;
}

export function VerificationReport({
  certificateId,
  documentHash,
  studentWallet,
  institutionAddress,
  issueDate,
  isValid,
  isRevoked,
}: VerificationReportProps) {
  const chainId = useChainId();
  const verificationUrl = `${window.location.origin}/verify?cert=${certificateId.toString()}`;
  const issueDateTime = new Date(Number(issueDate) * 1000);
  const fileName = `certificate-${certificateId.toString()}-verification-report.pdf`;

  return (
    <PDFDownloadLink
      document={
        <VerificationReportPDF
          certificateId={certificateId.toString()}
          documentHash={documentHash}
          studentWallet={studentWallet}
          institutionAddress={institutionAddress}
          issueDate={issueDateTime}
          isValid={isValid}
          isRevoked={isRevoked}
          chainId={chainId}
          verificationUrl={verificationUrl}
        />
      }
      fileName={fileName}
      className="btn-secondary flex items-center gap-2"
    >
      {({ loading }) => (
        <>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {loading ? 'Generating PDF...' : 'Download Report'}
        </>
      )}
    </PDFDownloadLink>
  );
}

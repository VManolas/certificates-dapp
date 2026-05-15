// src/components/CertificateDetailModal.tsx
import { useState } from 'react';
import { useChainId } from 'wagmi';
import { BlockExplorerLink } from './BlockExplorerLink';
import { VerificationReportWithPrivacy } from './VerificationReportWithPrivacy';
import { ShareCertificateModal } from './ShareCertificateModal';
import { Modal, ModalBody } from './ui/Modal';
import { useClipboard } from '@/hooks/useClipboard';
import { useIsInstitution } from '@/hooks/useInstitutionRegistry';
import { getChainName } from '@/lib/blockExplorer';
import type { CertificateDetails } from '@/hooks';

interface CertificateDetailModalProps {
  certificateId: bigint;
  certificate: CertificateDetails;
  onClose: () => void;
}

export function CertificateDetailModal({
  certificateId,
  certificate,
  onClose,
}: CertificateDetailModalProps) {
  const chainId = useChainId();
  const [showShareModal, setShowShareModal] = useState(false);
  const { copy, isFieldCopied } = useClipboard();
  
  // Fetch university name from blockchain
  const { institutionData, isLoading: isLoadingInstitution } = useIsInstitution(certificate.issuingInstitution as `0x${string}`);
  const universityName = institutionData?.name || `Institution ${certificate.issuingInstitution.slice(0, 6)}`;
  
  // Parse program name from metadata
  let programName = 'Unknown Program';
  if (certificate.metadataURI) {
    try {
      const metadata = JSON.parse(certificate.metadataURI);
      programName = metadata.program || certificate.metadataURI;
    } catch {
      programName = certificate.metadataURI;
    }
  }

  const issueDate = new Date(Number(certificate.issueDate) * 1000);
  const chainName = getChainName(chainId);
  const graduationYear =
    typeof certificate.graduationYear === 'bigint'
      ? Number(certificate.graduationYear)
      : certificate.graduationYear;

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        maxWidth="3xl"
        padding="none"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-700">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">
              Certificate #{certificateId.toString()}
            </h2>
            {certificate.isRevoked ? (
              <span className="badge badge-warning">Revoked</span>
            ) : (
              <span className="badge badge-success">Valid</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <ModalBody className="space-y-6" scrollable maxHeight="max-h-[80vh]">
            {/* General Information */}
            <div className="card bg-surface-800/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                General Information
              </h3>

              <div className="space-y-4">
                {/* Student Wallet */}
                <div>
                  <label className="block text-sm font-medium text-surface-400 mb-2">
                    Student Wallet
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-surface-900 rounded-lg p-3 text-sm text-surface-200 font-mono">
                      {certificate.studentWallet}
                    </code>
                    <button
                      onClick={() => copy(certificate.studentWallet, 'student')}
                      className="btn-secondary text-sm px-3 py-2"
                      title="Copy address"
                    >
                      {isFieldCopied('student') ? '✓' : '📋'}
                    </button>
                    <BlockExplorerLink
                      hash={certificate.studentWallet}
                      type="address"
                      className="btn-secondary text-sm px-3 py-2"
                      showIcon={false}
                    >
                      🔗
                    </BlockExplorerLink>
                  </div>
                </div>

                {/* Issuing Institution */}
                <div>
                  <label className="block text-sm font-medium text-surface-400 mb-2">
                    Issuing Institution Name
                  </label>
                  <div className="bg-surface-900 rounded-lg p-3 text-sm text-surface-200">
                    {isLoadingInstitution ? 'Loading institution name...' : universityName}
                  </div>
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-sm font-medium text-surface-400 mb-2">
                    Issue Date
                  </label>
                  <div className="bg-surface-900 rounded-lg p-3 text-sm text-surface-200">
                    {issueDate.toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZoneName: 'short',
                    })}
                  </div>
                </div>

                {/* Program */}
                <div>
                  <label className="block text-sm font-medium text-surface-400 mb-2">
                    Program
                  </label>
                  <div className="bg-surface-900 rounded-lg p-3 text-sm text-surface-200">
                    {programName}
                  </div>
                </div>

                {/* Graduation Year */}
                <div>
                  <label className="block text-sm font-medium text-surface-400 mb-2">
                    Graduation Year
                  </label>
                  <div className="bg-surface-900 rounded-lg p-3 text-sm text-surface-200">
                    {Number.isFinite(graduationYear) ? graduationYear : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Blockchain Proof */}
            <div className="card bg-surface-800/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Blockchain Proof
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-surface-400">Network:</span>
                  <span className="text-white font-medium">{chainName} (Chain ID: {chainId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Contract:</span>
                  <span className="text-white font-mono text-sm">CertificateRegistry</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Certificate ID:</span>
                  <span className="text-white font-mono">#{certificateId.toString()}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowShareModal(true)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Certificate
              </button>
              <VerificationReportWithPrivacy
                certificateId={certificateId}
                documentHash={certificate.documentHash}
                studentWallet={certificate.studentWallet}
                institutionAddress={certificate.issuingInstitution}
                issueDate={certificate.issueDate}
                isValid={!certificate.isRevoked}
                isRevoked={certificate.isRevoked}
                universityName={universityName}
                programName={programName}
              />
            </div>
          </ModalBody>
        </Modal>

      {/* Share Modal */}
      {showShareModal && (
        <ShareCertificateModal
          certificate={{
            ...certificate,
            certificateId: certificateId,
            documentHash: certificate.documentHash as `0x${string}`,
            studentWallet: certificate.studentWallet as `0x${string}`,
            issuingInstitution: certificate.issuingInstitution as `0x${string}`,
          }}
          universityName={universityName}
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </>
  );
}

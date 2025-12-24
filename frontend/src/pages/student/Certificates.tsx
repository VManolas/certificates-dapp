// src/pages/student/Certificates.tsx
import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { truncateHash } from '@/lib/pdfHash';
import { useCertificatesBatch, type CertificateDetails } from '@/hooks';
import { ShareCertificateModal } from '@/components/ShareCertificateModal';
import { WalletQRDisplay } from '@/components/WalletQRDisplay';
import { CertificateDetailModal } from '@/components/CertificateDetailModal';

export function StudentCertificates() {
  const { address, isConnected } = useAccount();

  // Get student's certificate IDs
  const { data: certificateIds, isLoading: idsLoading } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificatesByStudent',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  const certificates = (certificateIds as bigint[]) || [];
  
  // Use the new batch helper hook to load all certificates efficiently
  const { 
    certificates: certificateDetails, 
    isLoading: detailsLoading 
  } = useCertificatesBatch(
    certificates.length > 0 ? certificates : undefined,
    certificates.length > 0
  );

  const isLoading = idsLoading || detailsLoading;

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-surface-400">
          Please connect your wallet to view your certificates.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">My Certificates</h1>
        <p className="text-surface-400">
          View all certificates issued to your wallet address
        </p>
      </div>

      {/* Wallet QR Display */}
      {address && (
        <div className="mb-8">
          <WalletQRDisplay address={address} />
        </div>
      )}

      {/* Stats */}
      <div className="card mb-8">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-surface-400">Total Certificates</span>
            <p className="text-3xl font-bold text-white">{certificates.length}</p>
          </div>
          <div>
            <span className="text-sm text-surface-400">Active</span>
            <p className="text-3xl font-bold text-accent-400">
              {certificateDetails?.filter(c => c && !c.isRevoked).length || 0}
            </p>
          </div>
          <div>
            <span className="text-sm text-surface-400">Revoked</span>
            <p className="text-3xl font-bold text-yellow-400">
              {certificateDetails?.filter(c => c && c.isRevoked).length || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Certificates List */}
      {isLoading ? (
        <div className="card text-center py-12">
          <svg className="w-8 h-8 mx-auto mb-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-surface-400">Loading certificates...</p>
        </div>
      ) : certificates.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto mb-4 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No Certificates Found</h3>
          <p className="text-surface-400">
            You don't have any certificates issued to this wallet yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {certificates.map((certId, index) => (
            <CertificateCard 
              key={certId.toString()} 
              certificateId={certId}
              certificate={certificateDetails?.[index]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CertificateCard({ 
  certificateId, 
  certificate 
}: { 
  certificateId: bigint;
  certificate?: CertificateDetails;
}) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // No need to fetch individual certificate - passed from batch
  if (!certificate) {
    return (
      <div className="card animate-pulse">
        <div className="h-4 bg-surface-700 rounded w-1/4 mb-2" />
        <div className="h-3 bg-surface-700 rounded w-1/2" />
      </div>
    );
  }

  const issueDate = new Date(Number(certificate.issueDate) * 1000);

  return (
    <>
      <div className={`card ${certificate.isRevoked ? 'border-yellow-500/30' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-semibold text-white">
                Certificate #{certificateId.toString()}
              </span>
              {certificate.isRevoked ? (
                <span className="badge badge-warning">Revoked</span>
              ) : (
                <span className="badge badge-success">Valid</span>
              )}
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-surface-400">
                <span className="text-surface-500">Hash:</span>{' '}
                <span className="font-mono">{truncateHash(certificate.documentHash, 10, 8)}</span>
              </p>
              <p className="text-surface-400">
                <span className="text-surface-500">Issued by:</span>{' '}
                <span className="font-mono">{truncateHash(certificate.issuingInstitution, 8, 6)}</span>
              </p>
              <p className="text-surface-400">
                <span className="text-surface-500">Date:</span>{' '}
                {issueDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 ml-4">
            <button
              onClick={() => setIsDetailModalOpen(true)}
              className="btn-secondary flex items-center gap-2"
              aria-label="View details"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Details
            </button>
            {!certificate.isRevoked && (
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="btn-primary flex items-center gap-2"
                aria-label="Share certificate"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isShareModalOpen && (
        <ShareCertificateModal
          certificateId={certificateId}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {isDetailModalOpen && (
        <CertificateDetailModal
          certificateId={certificateId}
          certificate={certificate}
          onClose={() => setIsDetailModalOpen(false)}
        />
      )}
    </>
  );
}

export default StudentCertificates;


// src/pages/university/Certificates.tsx
import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useCertificatesBatch, type CertificateDetails } from '@/hooks';
import { useCertificateRevocation } from '@/hooks/useCertificateRevocation';
import { truncateHash } from '@/lib/pdfHash';
import { Link } from 'react-router-dom';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';

export function UniversityCertificates() {
  const { address, isConnected } = useAccount();
  const { institutionData } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('all');

  // Get certificate IDs for this institution
  const { data: institutionCerts, isLoading: isLoadingIds, refetch: refetchIds } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificatesByInstitution',
    args: address ? [address, 0n, 100n] : undefined,
    query: {
      enabled: !!address && isConnected,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
    },
  });

  const certificateIds = institutionCerts ? (institutionCerts[0] as bigint[]) : undefined;

  // Fetch certificate details
  const { certificates: allCertificates, foundFlags, isLoading: isLoadingCerts, refetch: refetchCerts } = useCertificatesBatch(
    certificateIds,
    !!certificateIds && certificateIds.length > 0
  );

  const isLoading = isLoadingIds || isLoadingCerts;

  const handleRefresh = async () => {
    await refetchIds();
    await refetchCerts();
  };

  // Map certificates with their IDs
  const myCertificates = (allCertificates || [])
    .map((cert, index) => ({
      cert,
      id: certificateIds?.[index] || BigInt(0),
      found: foundFlags?.[index] || false,
    }))
    .filter(({ found }) => found);

  // Apply filters
  const filteredCertificates = myCertificates.filter(({ cert }) => {
    if (!cert) return false;

    // Status filter
    if (statusFilter === 'active' && cert.isRevoked) return false;
    if (statusFilter === 'revoked' && !cert.isRevoked) return false;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        cert.certificateId.toString().includes(search) ||
        cert.studentWallet.toLowerCase().includes(search) ||
        cert.documentHash.toLowerCase().includes(search)
      );
    }

    return true;
  });

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

  if (!institutionData?.isActive) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Institution Not Registered</h1>
        <p className="text-surface-400 mb-6">
          You must be a registered institution to view certificates.
        </p>
        <Link to="/university/register" className="btn-primary">
          Register Institution
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Certificate Registry</h1>
            <p className="text-surface-400">
              View and manage all certificates issued by your institution
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-secondary flex items-center gap-2"
          >
            <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Total Issued (On-Chain)</div>
          <div className="text-3xl font-bold text-white">
            {institutionData?.totalCertificatesIssued.toString() || '0'}
          </div>
          <div className="text-xs text-surface-500 mt-1">
            {isLoading ? 'Loading...' : `Loaded: ${myCertificates.length}`}
          </div>
        </div>
        <div className="card border-accent-500/30">
          <div className="text-sm text-surface-400 mb-1">Active</div>
          <div className="text-3xl font-bold text-accent-400">
            {myCertificates.filter(({ cert }) => cert && !cert.isRevoked).length}
          </div>
        </div>
        <div className="card border-yellow-500/30">
          <div className="text-sm text-surface-400 mb-1">Revoked</div>
          <div className="text-3xl font-bold text-yellow-400">
            {myCertificates.filter(({ cert }) => cert && cert.isRevoked).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, student wallet, or hash..."
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'revoked')}
              className="input w-full"
            >
              <option value="all">All Certificates</option>
              <option value="active">Active Only</option>
              <option value="revoked">Revoked Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Certificate List */}
      {isLoading ? (
        <div className="card text-center py-12">
          <svg className="w-8 h-8 mx-auto mb-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-surface-400">Loading certificates...</p>
        </div>
      ) : filteredCertificates.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto mb-4 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">
            {searchTerm || statusFilter !== 'all' ? 'No Matching Certificates' : 'No Certificates Issued'}
          </h3>
          <p className="text-surface-400 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Start issuing certificates to see them here'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Link to="/university/issue" className="btn-primary inline-flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Issue Certificate
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCertificates.map(({ cert, id }) => (
            <CertificateRow
              key={id.toString()}
              certificateId={id}
              certificate={cert}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CertificateRow({
  certificateId,
  certificate,
}: {
  certificateId: bigint;
  certificate: CertificateDetails;
}) {
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revocationReason, setRevocationReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const {
    revokeCertificate,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  } = useCertificateRevocation();

  const issueDate = new Date(Number(certificate.issueDate) * 1000);

  const handleRevoke = () => {
    // Validate reason
    if (!revocationReason.trim()) {
      setReasonError('Revocation reason is required');
      return;
    }
    if (revocationReason.length > 500) {
      setReasonError('Reason must be less than 500 characters');
      return;
    }
    setReasonError(null);
    
    revokeCertificate(certificateId, revocationReason.trim());
  };

  // Close modal on success
  if (isSuccess && showRevokeConfirm) {
    setTimeout(() => {
      setShowRevokeConfirm(false);
      setRevocationReason('');
      setReasonError(null);
      reset();
      // Refresh page to show updated status
      window.location.reload();
    }, 2000);
  }

  return (
    <>
      <div className={`card ${certificate.isRevoked ? 'border-yellow-500/30 bg-yellow-500/5' : ''}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-semibold text-white">
                Certificate #{certificateId.toString()}
              </span>
              {certificate.isRevoked ? (
                <span className="badge badge-warning">Revoked</span>
              ) : (
                <span className="badge badge-success">Active</span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="text-surface-500">Student Wallet:</span>{' '}
                <span className="text-white font-mono">{truncateHash(certificate.studentWallet, 8, 6)}</span>
              </div>
              <div>
                <span className="text-surface-500">Issue Date:</span>{' '}
                <span className="text-white">
                  {issueDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-surface-500">Document Hash:</span>{' '}
                <span className="text-white font-mono text-xs">{truncateHash(certificate.documentHash, 12, 10)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 ml-4">
            <a
              href={`/verify?cert=${certificateId.toString()}`}
              className="btn-secondary text-sm px-4 py-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              View
            </a>
            {!certificate.isRevoked && (
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="btn-secondary text-sm px-4 py-2 text-yellow-400 hover:text-yellow-300 border-yellow-500/30 hover:border-yellow-500/50"
              >
                Revoke
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Revocation Confirmation Modal */}
      {showRevokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-900 rounded-2xl shadow-2xl max-w-md w-full border border-surface-700">
            <div className="p-6">
              <h2 className="text-xl font-bold text-white mb-4">Revoke Certificate?</h2>
              
              {isSuccess ? (
                <div className="text-center py-4">
                  <svg className="w-16 h-16 mx-auto mb-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-accent-400 font-semibold">Certificate Revoked Successfully</p>
                  <p className="text-surface-400 text-sm mt-2">Refreshing...</p>
                </div>
              ) : (
                <>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                    <p className="text-yellow-400 text-sm">
                      <strong>Warning:</strong> This action cannot be undone. The certificate will be permanently marked as revoked on the blockchain.
                    </p>
                  </div>

                  <div className="bg-surface-800/50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                    <div>
                      <span className="text-surface-500">Certificate ID:</span>{' '}
                      <span className="text-white font-mono">#{certificateId.toString()}</span>
                    </div>
                    <div>
                      <span className="text-surface-500">Student:</span>{' '}
                      <span className="text-white font-mono">{truncateHash(certificate.studentWallet, 8, 6)}</span>
                    </div>
                  </div>

                  {/* Revocation Reason Input */}
                  <div className="mb-4">
                    <label htmlFor="revocationReason" className="block text-sm font-medium text-surface-300 mb-2">
                      Revocation Reason <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      id="revocationReason"
                      value={revocationReason}
                      onChange={(e) => {
                        setRevocationReason(e.target.value);
                        setReasonError(null);
                      }}
                      placeholder="e.g., Fraudulent credentials discovered, Student no longer enrolled, etc."
                      className="w-full px-4 py-3 bg-surface-800 border border-surface-600 rounded-lg focus:ring-2 focus:ring-accent-500 focus:border-transparent text-white placeholder-surface-500 resize-none"
                      rows={3}
                      maxLength={500}
                      disabled={isPending || isConfirming}
                    />
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-xs ${reasonError ? 'text-red-400' : 'text-surface-500'}`}>
                        {reasonError || `${revocationReason.length}/500 characters`}
                      </span>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                      <p className="text-red-400 text-sm">{error.message}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowRevokeConfirm(false);
                        setRevocationReason('');
                        setReasonError(null);
                        reset();
                      }}
                      className="btn-secondary flex-1"
                      disabled={isPending || isConfirming}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRevoke}
                      className="btn-primary flex-1 bg-yellow-500 hover:bg-yellow-600"
                      disabled={isPending || isConfirming || !revocationReason.trim()}
                    >
                      {isPending ? 'Waiting for signature...' : isConfirming ? 'Revoking...' : 'Confirm Revocation'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UniversityCertificates;

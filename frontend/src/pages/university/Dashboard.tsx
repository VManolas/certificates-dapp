// src/pages/university/Dashboard.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useCertificatesBatch, useCanIssueCertificates } from '@/hooks';
import { truncateHash } from '@/lib/pdfHash';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { logger } from '@/lib/logger';

export function UniversityDashboard() {
  const { isConnected, address } = useAccount();
  const { institutionData, refetchInstitution } = useAuthStore();
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Real-time institution status check
  const { canIssue, reason, refetch: refetchStatus } = useCanIssueCertificates();

  // Get certificate IDs for this institution
  // Fetch more certificates than we'll display (50) so we can sort by date
  // and show the 5 most recent ones
  const { data: institutionCerts, refetch: refetchCertIds } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificatesByInstitution',
    args: address ? [address, 0n, 50n] : undefined,
    query: {
      enabled: !!address && isConnected,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      staleTime: 0,
      gcTime: 0,
    },
  });

  const certificateIds = institutionCerts && Array.isArray(institutionCerts) && institutionCerts.length > 0
    ? (institutionCerts[0] as bigint[]) 
    : undefined;

  // Fetch certificate details
  const { certificates: allCertificates, foundFlags, isLoading, refetch: refetchCertDetails } = useCertificatesBatch(
    certificateIds,
    !!certificateIds && certificateIds.length > 0
  );

  const handleRefreshCertificates = async () => {
    setIsRefreshing(true);
    logger.info('Refreshing certificates for university dashboard');
    try {
      await refetchCertIds();
      await refetchCertDetails();
      if (refetchInstitution) {
        await refetchInstitution();
      }
      logger.info('Successfully refreshed certificates');
    } catch (error) {
      logger.error('Failed to refresh certificates', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const recentCertificates = (allCertificates || [])
    .map((cert, index) => ({
      cert,
      id: certificateIds?.[index] || BigInt(0),
      found: foundFlags?.[index] || false,
    }))
    .filter(({ found }) => found)
    .sort((a, b) => {
      // Sort by issue date (timestamp) in descending order (most recent first)
      const dateA = Number(a.cert.issueDate);
      const dateB = Number(b.cert.issueDate);
      return dateB - dateA;
    })
    .slice(0, 5);

  // Log certificate data for debugging
  logger.debug('Dashboard certificate data', {
    totalCertIds: certificateIds?.length || 0,
    certificateIds: certificateIds?.map(id => id.toString()),
    allCertificatesCount: allCertificates?.length || 0,
    recentCertificatesCount: recentCertificates.length,
    recentCertIds: recentCertificates.map(({ id }) => id.toString()),
  });

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-surface-400">Please connect your wallet to access the university dashboard.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">University Dashboard</h1>
          <p className="text-surface-400">
            Manage certificates and view issuance statistics
          </p>
        </div>
        <div className="flex gap-3">
          {canIssue ? (
            <>
              <Link to="/university/bulk-upload" className="btn-secondary">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Bulk Upload
              </Link>
              <Link to="/university/issue" className="btn-primary">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Issue Certificate
              </Link>
            </>
          ) : (
            <>
              <button 
                onClick={() => setShowBlockedModal(true)}
                className="btn-secondary opacity-60 cursor-not-allowed"
                disabled
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Bulk Upload
                <svg className="w-4 h-4 ml-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
              <button 
                onClick={() => setShowBlockedModal(true)}
                className="btn-primary opacity-60 cursor-not-allowed"
                disabled
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Issue Certificate
                <svg className="w-4 h-4 ml-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Total Issued</div>
          <div className="text-3xl font-bold text-white">
            {institutionData?.totalCertificatesIssued.toString() || '0'}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Status</div>
          <div>
            {institutionData?.isActive ? (
              <span className="badge badge-success">Active</span>
            ) : institutionData?.isVerified ? (
              <span className="badge badge-warning">Suspended</span>
            ) : (
              <span className="badge badge-info">Pending Verification</span>
            )}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Institution</div>
          <div className="text-white font-medium truncate">
            {institutionData?.name || 'Not Registered'}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Email Domain</div>
          <div className="text-white font-mono text-sm">
            {institutionData?.emailDomain || '-'}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Issue New Certificate - Block if suspended */}
        {canIssue ? (
          <Link
            to="/university/issue"
            className="card hover:border-primary-500/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Issue New Certificate</h3>
                <p className="text-surface-400 text-sm">Upload PDF and issue to student wallet</p>
              </div>
            </div>
          </Link>
        ) : (
          <button
            onClick={() => setShowBlockedModal(true)}
            className="card border-surface-700/50 opacity-60 cursor-not-allowed text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-700/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-surface-400">Issue New Certificate</h3>
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-surface-500 text-sm">Unavailable - Institution suspended</p>
              </div>
            </div>
          </button>
        )}

        {/* Certificate Registry - Block if suspended */}
        {canIssue ? (
          <Link
            to="/university/certificates"
            className="card hover:border-purple-500/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Certificate Registry</h3>
                <p className="text-surface-400 text-sm">View and manage all issued certificates</p>
              </div>
            </div>
          </Link>
        ) : (
          <button
            onClick={() => setShowBlockedModal(true)}
            className="card border-surface-700/50 opacity-60 cursor-not-allowed text-left w-full"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-700/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-surface-400">Certificate Registry</h3>
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-surface-500 text-sm">Unavailable - Institution suspended</p>
              </div>
            </div>
          </button>
        )}

        <Link
          to="/verify"
          className="card hover:border-accent-500/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex items-center justify-center group-hover:bg-accent-500/20 transition-colors">
              <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Verify Certificate</h3>
              <p className="text-surface-400 text-sm">Check authenticity of any certificate</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Certificates */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Recent Certificates</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshCertificates}
              disabled={isLoading || isRefreshing}
              className="text-sm text-surface-400 hover:text-white transition-colors flex items-center gap-1"
              title="Refresh certificates"
            >
              <svg 
                className={`w-4 h-4 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isLoading || isRefreshing ? 'Loading...' : 'Refresh'}
            </button>
            <Link to="/university/certificates" className="text-sm text-primary-400 hover:text-primary-300">
              View all →
            </Link>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8 text-surface-400">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p>Loading certificates...</p>
          </div>
        ) : recentCertificates.length === 0 ? (
          <div className="text-center py-12 text-surface-400">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No certificates issued yet</p>
            <Link to="/university/issue" className="text-primary-400 hover:text-primary-300 mt-2 inline-block">
              Issue your first certificate →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentCertificates.map(({ cert, id }) => (
              <div key={id.toString()} className="p-4 bg-surface-800 rounded-lg border border-surface-700 hover:border-primary-500/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-mono text-surface-400">ID #{id.toString()}</span>
                      {cert.isRevoked ? (
                        <span className="badge badge-error">Revoked</span>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </div>
                    <div className="text-sm text-surface-300 mb-1">
                      <span className="text-surface-400">Student:</span> {truncateHash(cert.studentWallet)}
                    </div>
                    <div className="text-sm text-surface-300">
                      <span className="text-surface-400">Hash:</span> {truncateHash(cert.documentHash)}
                    </div>
                  </div>
                  <div className="text-xs text-surface-500">
                    {new Date(Number(cert.issueDate) * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Blocked Access Modal */}
      {showBlockedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 rounded-lg border border-red-500/30 max-w-md w-full shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Feature Unavailable</h3>
                  <p className="text-red-400">{reason}</p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBlockedModal(false)}
                  className="btn-secondary flex-1"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => {
                    refetchStatus();
                    if (refetchInstitution) refetchInstitution();
                    setShowBlockedModal(false);
                  }}
                  className="btn-primary flex-1"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UniversityDashboard;


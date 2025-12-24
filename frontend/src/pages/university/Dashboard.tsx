// src/pages/university/Dashboard.tsx
import { Link } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useCertificatesBatch } from '@/hooks';
import { truncateHash } from '@/lib/pdfHash';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';

export function UniversityDashboard() {
  const { isConnected, address } = useAccount();
  const { institutionData } = useAuthStore();

  // Get certificate IDs for this institution
  const { data: institutionCerts } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificatesByInstitution',
    args: address ? [address, 0n, 5n] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  });

  const certificateIds = institutionCerts ? (institutionCerts[0] as bigint[]) : undefined;

  // Fetch certificate details
  const { certificates: allCertificates, foundFlags, isLoading } = useCertificatesBatch(
    certificateIds,
    !!certificateIds && certificateIds.length > 0
  );

  const recentCertificates = (allCertificates || [])
    .map((cert, index) => ({
      cert,
      id: certificateIds?.[index] || BigInt(0),
      found: foundFlags?.[index] || false,
    }))
    .filter(({ found }) => found)
    .slice(0, 5);

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
          <Link to="/university/certificates" className="text-sm text-primary-400 hover:text-primary-300">
            View all →
          </Link>
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
    </div>
  );
}

export default UniversityDashboard;


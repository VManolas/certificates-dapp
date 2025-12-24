// src/pages/employer/Dashboard.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useVerificationHistory } from '@/hooks/useVerificationHistory';
import { useStudentCertificates } from '@/hooks';
import { truncateHash } from '@/lib/pdfHash';
import { isAddress } from 'viem';

// Helper function to safely check if certificateId should be displayed
const shouldShowCertificateId = (certificateId: bigint | undefined): certificateId is bigint => {
  return certificateId !== undefined && certificateId > BigInt(0);
};

export function EmployerDashboard() {
  const { isConnected } = useAccount();
  const { history, clearHistory, exportToCSV, getStats } = useVerificationHistory();
  const stats = getStats();

  const [walletAddress, setWalletAddress] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch certificates for the searched wallet
  const {
    certificateIds,
    isLoading: isLoadingCerts,
  } = useStudentCertificates(
    isSearching && isAddress(walletAddress) ? walletAddress as `0x${string}` : undefined,
    isSearching && isAddress(walletAddress)
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);

    if (!walletAddress.trim()) {
      setSearchError('Please enter a wallet address');
      return;
    }

    if (!isAddress(walletAddress)) {
      setSearchError('Invalid wallet address format');
      return;
    }

    setIsSearching(true);
  };

  const handleClearSearch = () => {
    setWalletAddress('');
    setSearchError(null);
    setIsSearching(false);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all verification history? This action cannot be undone.')) {
      clearHistory();
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-surface-400">
          Please connect your wallet to access the employer dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Employer Dashboard</h1>
          <p className="text-surface-400">
            Verify certificates and track your verification history
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/verify" className="btn-secondary">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Verify PDF
          </Link>
          <Link to="/employer/batch-verify" className="btn-primary">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Batch Verify
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-surface-400 mb-1">Total Verifications</div>
          <div className="text-3xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="card border-accent-500/30">
          <div className="text-sm text-surface-400 mb-1">Valid Certificates</div>
          <div className="text-3xl font-bold text-accent-400">{stats.valid}</div>
        </div>
        <div className="card border-red-500/30">
          <div className="text-sm text-surface-400 mb-1">Invalid</div>
          <div className="text-3xl font-bold text-red-400">{stats.invalid}</div>
        </div>
        <div className="card border-yellow-500/30">
          <div className="text-sm text-surface-400 mb-1">Revoked</div>
          <div className="text-3xl font-bold text-yellow-400">{stats.revoked}</div>
        </div>
      </div>

      {/* Wallet Verification Section */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Verify by Wallet Address</h2>
        <p className="text-surface-400 text-sm mb-4">
          Enter a student's wallet address to view all certificates issued to that address
        </p>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="0x..."
              className={`input flex-1 font-mono ${searchError ? 'border-error-500 focus:border-error-500' : ''}`}
            />
            <button type="submit" className="btn-primary px-6">
              Search
            </button>
            {isSearching && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="btn-secondary"
              >
                Clear
              </button>
            )}
          </div>
          {searchError && (
            <p className="text-error-400 text-sm">{searchError}</p>
          )}
        </form>

        {/* Search Results */}
        {isSearching && (
          <div className="mt-6 pt-6 border-t border-surface-700">
            {isLoadingCerts ? (
              <div className="text-center py-8">
                <svg className="w-8 h-8 mx-auto mb-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-surface-400">Loading certificates...</p>
              </div>
            ) : certificateIds && certificateIds.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Found {certificateIds.length} certificate{certificateIds.length !== 1 ? 's' : ''}
                  </h3>
                  <span className="text-sm text-surface-400 font-mono">
                    {truncateHash(walletAddress, 8, 6)}
                  </span>
                </div>
                <div className="space-y-3">
                  {certificateIds.map((certId) => (
                    <div key={certId.toString()} className="rounded-lg bg-surface-800/50 p-4 border border-surface-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold mb-1">
                            Certificate #{certId.toString()}
                          </p>
                          <a
                            href={`/verify?cert=${certId.toString()}`}
                            className="text-primary-400 hover:text-primary-300 text-sm inline-flex items-center gap-1"
                          >
                            View Details
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </a>
                        </div>
                        <span className="badge badge-success">On-chain</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto mb-4 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-white mb-2">No Certificates Found</h3>
                <p className="text-surface-400">
                  This wallet address has no certificates issued to it.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Verifications */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Recent Verifications</h2>
          <div className="flex gap-2">
            {history.length > 0 && (
              <>
                <button
                  onClick={exportToCSV}
                  className="text-sm text-primary-400 hover:text-primary-300 transition-colors inline-flex items-center gap-1"
                  title="Export to CSV"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
                <button
                  onClick={handleClearHistory}
                  className="text-sm text-surface-400 hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-4 text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-semibold text-white mb-2">No Verification History</h3>
            <p className="text-surface-400 mb-4">
              Your verification history will appear here
            </p>
            <a href="/verify" className="btn-primary inline-flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Verify a Certificate
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg bg-surface-800/50 p-4 border border-surface-700 hover:border-surface-600 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {entry.isValid && !entry.isRevoked ? (
                        <span className="badge badge-success">Valid</span>
                      ) : entry.isRevoked ? (
                        <span className="badge badge-warning">Revoked</span>
                      ) : (
                        <span className="badge badge-error">Invalid</span>
                      )}
                      <span className="text-xs text-surface-500 uppercase">
                        {entry.verificationType}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {shouldShowCertificateId(entry.certificateId) && (
                        <p className="text-surface-400">
                          <span className="text-surface-500">Certificate ID:</span>{' '}
                          <span className="font-mono">#{String(entry.certificateId)}</span>
                        </p>
                      )}
                      {entry.walletAddress && (
                        <p className="text-surface-400">
                          <span className="text-surface-500">Wallet:</span>{' '}
                          <span className="font-mono">{truncateHash(entry.walletAddress, 8, 6)}</span>
                        </p>
                      )}
                      {entry.documentHash && (
                        <p className="text-surface-400">
                          <span className="text-surface-500">Hash:</span>{' '}
                          <span className="font-mono">{truncateHash(entry.documentHash, 10, 8)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-surface-500">
                    {new Date(entry.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            {history.length > 10 && (
              <p className="text-center text-sm text-surface-500 pt-2">
                Showing 10 of {history.length} verifications
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmployerDashboard;

// src/pages/employer/BatchVerify.tsx
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { isAddress } from 'viem';
import { useStudentCertificates } from '@/hooks';
import { truncateHash } from '@/lib/pdfHash';

interface BatchEntry {
  id: string;
  walletAddress: string;
  isValid: boolean;
  status: 'pending' | 'processing' | 'completed' | 'error';
  certificateCount?: number;
  error?: string;
}

export function BatchVerify() {
  const { isConnected } = useAccount();
  const [csvText, setCsvText] = useState('');
  const [entries, setEntries] = useState<BatchEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Parse CSV input
  const parseCSV = useCallback((text: string): string[] => {
    const lines = text
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && isAddress(line));
    
    // Remove duplicates
    return [...new Set(lines)];
  }, []);

  const handleParseInput = () => {
    const wallets = parseCSV(csvText);
    
    if (wallets.length === 0) {
      alert('No valid wallet addresses found. Please enter valid Ethereum addresses.');
      return;
    }

    if (wallets.length > 100) {
      alert('Maximum 100 addresses per batch. Please reduce the number of addresses.');
      return;
    }

    const newEntries: BatchEntry[] = wallets.map((wallet, index) => ({
      id: `${index}-${wallet}`,
      walletAddress: wallet,
      isValid: true,
      status: 'pending',
    }));

    setEntries(newEntries);
  };

  const handleStartVerification = async () => {
    setIsProcessing(true);
    setCurrentIndex(0);
  };

  const handleExportResults = () => {
    if (entries.length === 0) return;

    const headers = ['Wallet Address', 'Status', 'Certificate Count', 'Error'];
    const rows = entries.map((entry) => [
      entry.walletAddress,
      entry.status === 'completed' ? (entry.certificateCount! > 0 ? 'Has Certificates' : 'No Certificates') : entry.status,
      entry.certificateCount?.toString() || '',
      entry.error || '',
    ].map((cell) => `"${cell}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `batch-verification-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setCsvText('');
    setEntries([]);
    setIsProcessing(false);
    setCurrentIndex(0);
  };

  const completedCount = entries.filter((e) => e.status === 'completed').length;
  const hasResults = entries.some((e) => e.status === 'completed');

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-surface-400">
          Please connect your wallet to use batch verification.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Batch Verification</h1>
          <p className="text-surface-400">
            Verify multiple wallet addresses at once
          </p>
        </div>
        <Link to="/employer/dashboard" className="btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>

      {/* Input Section */}
      {entries.length === 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-4">Enter Wallet Addresses</h2>
          <p className="text-surface-400 text-sm mb-4">
            Paste wallet addresses below, one per line or separated by commas. Maximum 100 addresses.
          </p>
          
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="0x1234...abcd
0x5678...efgh
0x9abc...ijkl"
            className="input w-full h-48 font-mono text-sm"
          />

          <div className="flex justify-between items-center mt-4">
            <p className="text-sm text-surface-500">
              {parseCSV(csvText).length} valid addresses detected
            </p>
            <button
              onClick={handleParseInput}
              disabled={parseCSV(csvText).length === 0}
              className="btn-primary"
            >
              Parse & Preview
            </button>
          </div>
        </div>
      )}

      {/* Preview / Processing Section */}
      {entries.length > 0 && (
        <>
          {/* Progress Bar */}
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-surface-400">
                {isProcessing ? 'Verifying...' : hasResults ? 'Verification Complete' : 'Ready to verify'}
              </span>
              <span className="text-sm text-white font-semibold">
                {completedCount} / {entries.length}
              </span>
            </div>
            <div className="w-full bg-surface-700 rounded-full h-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(completedCount / entries.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            {!isProcessing && !hasResults && (
              <>
                <button onClick={handleStartVerification} className="btn-primary">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Verification
                </button>
                <button onClick={handleReset} className="btn-secondary">
                  Reset
                </button>
              </>
            )}
            {hasResults && (
              <>
                <button onClick={handleExportResults} className="btn-primary">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Results (CSV)
                </button>
                <button onClick={handleReset} className="btn-secondary">
                  New Batch
                </button>
              </>
            )}
          </div>

          {/* Results Table */}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">
                    Wallet Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">
                    Certificates
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-surface-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {entries.map((entry, index) => (
                  <BatchEntryRow
                    key={entry.id}
                    entry={entry}
                    isActive={isProcessing && index === currentIndex}
                    onComplete={(certCount) => {
                      setEntries((prev) =>
                        prev.map((e, i) =>
                          i === index
                            ? { ...e, status: 'completed', certificateCount: certCount }
                            : e
                        )
                      );
                      if (index < entries.length - 1) {
                        setCurrentIndex(index + 1);
                      } else {
                        setIsProcessing(false);
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Individual entry row with verification logic
function BatchEntryRow({
  entry,
  isActive,
  onComplete,
}: {
  entry: BatchEntry;
  isActive: boolean;
  onComplete: (certCount: number) => void;
}) {
  // Only fetch when this row is active
  const { certificateIds, isLoading } = useStudentCertificates(
    isActive ? (entry.walletAddress as `0x${string}`) : undefined,
    isActive
  );

  // When loading completes, call onComplete
  if (isActive && !isLoading && certificateIds !== undefined) {
    // Use setTimeout to avoid state update during render
    setTimeout(() => onComplete(certificateIds?.length || 0), 0);
  }

  return (
    <tr className={isActive ? 'bg-primary-500/10' : ''}>
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-white">
          {truncateHash(entry.walletAddress, 10, 8)}
        </span>
      </td>
      <td className="px-4 py-3">
        {entry.status === 'pending' && (
          <span className="badge bg-surface-700 text-surface-300">Pending</span>
        )}
        {(entry.status === 'processing' || isActive) && (
          <span className="badge bg-primary-500/20 text-primary-300 flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Checking
          </span>
        )}
        {entry.status === 'completed' && (
          <span className={`badge ${entry.certificateCount! > 0 ? 'badge-success' : 'bg-surface-700 text-surface-300'}`}>
            {entry.certificateCount! > 0 ? 'Has Certs' : 'No Certs'}
          </span>
        )}
        {entry.status === 'error' && (
          <span className="badge badge-error">Error</span>
        )}
      </td>
      <td className="px-4 py-3">
        {entry.status === 'completed' && (
          <span className="text-white font-semibold">
            {entry.certificateCount}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {entry.status === 'completed' && entry.certificateCount! > 0 && (
          <Link
            to={`/employer/dashboard?search=${entry.walletAddress}`}
            className="text-primary-400 hover:text-primary-300 text-sm"
          >
            View Details →
          </Link>
        )}
      </td>
    </tr>
  );
}

export default BatchVerify;

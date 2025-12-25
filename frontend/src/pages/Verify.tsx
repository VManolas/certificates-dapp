// src/pages/Verify.tsx
import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { generatePDFHash, formatFileSize, truncateHash, type HashResult } from '@/lib/pdfHash';
import { useCertificateVerification, useHashExists, useCertificateDetails } from '@/hooks';
import { useVerificationHistory } from '@/hooks/useVerificationHistory';
import { useAuthStore } from '@/store/authStore';
import { QRScanner } from '@/components/QRScanner';
import { VerificationReport } from '@/components/VerificationReport';
// BlockExplorerLink import removed - not used in this component
import { CertificateDetailModal } from '@/components/CertificateDetailModal';
import { validatePdfFile, globalRateLimiter } from '@/lib/sanitization';
import { parseError, withRetry } from '@/lib/errorHandling';
import { logger } from '@/lib/logger';

type VerificationState = 'idle' | 'hashing' | 'verifying' | 'complete' | 'verifying-id';

export function Verify() {
  const [searchParams] = useSearchParams();
  const certIdParam = searchParams.get('cert');
  const { role } = useAuthStore();
  const { addEntry } = useVerificationHistory();
  const queryClient = useQueryClient();
  
  const [, setFile] = useState<File | null>(null);
  const [hashResult, setHashResult] = useState<HashResult | null>(null);
  const [state, setState] = useState<VerificationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasLoggedVerification, setHasLoggedVerification] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [verificationSession, setVerificationSession] = useState(0);

  // Certificate ID verification (from URL parameter)
  const certificateIdFromUrl = certIdParam ? BigInt(certIdParam) : undefined;
  const {
    certificate: certFromId,
    isLoading: isLoadingCertById,
    error: certByIdError,
  } = useCertificateDetails(certificateIdFromUrl, !!certificateIdFromUrl);

  // Initialize state based on URL parameter
  useEffect(() => {
    if (certificateIdFromUrl && !isLoadingCertById) {
      setState('verifying-id');
    }
  }, [certificateIdFromUrl, isLoadingCertById]);

  // Use the new hash exists helper hook for optimized duplicate check
  const {
    isLoading: isCheckingHash,
  } = useHashExists(
    hashResult?.hash as `0x${string}` | undefined,
    state === 'verifying'
  );

  // Use the certificate verification hook (for PDF hash verification)
  const { 
    isValid, 
    isRevoked, 
    certificateId, 
    isLoading: isVerifying,
    error: verifyError,
  } = useCertificateVerification(
    hashResult?.hash,
    state === 'verifying',
    verificationSession
  );

  // Fetch full certificate details when we have a certificateId from PDF verification
  const {
    certificate: certFromPdfVerification,
    isLoading: isLoadingCertFromPdf,
  } = useCertificateDetails(
    certificateId && certificateId > 0n ? certificateId : undefined,
    state === 'complete' && !!certificateId && certificateId > 0n
  );

  // Update state when verification completes
  if ((isValid !== undefined || verifyError) && state === 'verifying' && !isVerifying && !isCheckingHash) {
    setState('complete');
  }

  // Log verification to history (for employer role only)
  useEffect(() => {
    if (role === 'employer' && state === 'complete' && !hasLoggedVerification && hashResult) {
      if (isValid !== undefined) {
        addEntry({
          verificationType: 'pdf',
          isValid: isValid,
          isRevoked: isRevoked || false,
          certificateId: (certificateId && certificateId > 0n) ? certificateId : undefined,
          documentHash: hashResult.hash,
        });
        setHasLoggedVerification(true);
      }
    }
  }, [role, state, isValid, isRevoked, certificateId, hashResult, hasLoggedVerification, addEntry]);

  // Log certificate ID verification to history
  useEffect(() => {
    if (role === 'employer' && state === 'verifying-id' && !hasLoggedVerification && certFromId && !isLoadingCertById) {
      addEntry({
        verificationType: 'link',
        isValid: true,
        isRevoked: certFromId.isRevoked || false,
        certificateId: certificateIdFromUrl,
        studentAddress: certFromId.studentWallet,
        institutionAddress: certFromId.issuingInstitution,
      });
      setHasLoggedVerification(true);
    }
  }, [role, state, certFromId, certificateIdFromUrl, isLoadingCertById, hasLoggedVerification, addEntry]);

  const handleFile = useCallback(async (selectedFile: File) => {
    // Increment session to force new query with different key
    setVerificationSession(prev => prev + 1);
    
    // Clear any existing verification data first
    queryClient.removeQueries({ queryKey: ['readContract'] });
    
    setError(null);
    setHashResult(null);
    setState('hashing');
    setFile(selectedFile);
    setHasLoggedVerification(false); // Reset logging flag

    // Validate file before processing
    const validation = validatePdfFile(selectedFile);
    if (!validation.valid) {
      setError(validation.error || 'Invalid PDF file');
      setState('idle');
      logger.warn('PDF verification validation failed', { 
        fileName: selectedFile.name, 
        error: validation.error 
      });
      return;
    }

    // Rate limiting check
    if (!globalRateLimiter.isAllowed('certificate-verify')) {
      const remaining = globalRateLimiter.getRemainingAttempts('certificate-verify');
      setError(`Rate limit exceeded. Please wait before verifying another certificate. Remaining attempts: ${remaining}`);
      setState('idle');
      logger.warn('Certificate verification rate limited');
      return;
    }

    try {
      logger.debug('Processing PDF for verification', { 
        fileName: selectedFile.name, 
        size: selectedFile.size 
      });

      // Use retry logic for hash generation
      const result = await withRetry(
        () => generatePDFHash(selectedFile),
        { maxAttempts: 2, delayMs: 1000 }
      );

      setHashResult(result);
      setState('verifying');
      logger.userAction('PDF verification initiated', { fileName: selectedFile.name });
    } catch (err) {
      const errorResponse = parseError(err);
      setError(errorResponse.message);
      setState('idle');
      logger.error('Failed to process PDF for verification', err);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFile(droppedFile);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFile(selectedFile);
      }
    },
    [handleFile]
  );

  const resetVerification = () => {
    // Force a full page refresh to clear all state and cache
    window.location.href = '/verify';
  };

  // Render certificate ID verification result
  if (state === 'verifying-id') {
    if (isLoadingCertById) {
      return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-surface-950 via-primary-950/20 to-surface-950">
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-2xl mx-auto">
              <div className="card text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/10 mb-6">
                  <svg className="w-8 h-8 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Verifying Certificate...</h3>
                <p className="text-surface-400">
                  Certificate ID: #{certificateIdFromUrl?.toString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (certByIdError || !certFromId) {
      return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-surface-950 via-primary-950/20 to-surface-950">
          <div className="container mx-auto px-4 py-16">
            <div className="max-w-2xl mx-auto">
              <div className="card border-red-500/30 bg-red-500/10">
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Certificate Not Found</h2>
                    <p className="text-red-400">
                      Certificate #{certificateIdFromUrl?.toString()} does not exist in the registry
                    </p>
                  </div>
                </div>
                <button onClick={resetVerification} className="btn-secondary w-full">
                  Verify Another Certificate
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Certificate found - display details
    const issueDate = new Date(Number(certFromId.issueDate) * 1000);
    
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-surface-950 via-primary-950/20 to-surface-950">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Status Card */}
            <div
              className={`card ${
                !certFromId.isRevoked
                  ? 'border-accent-500/30 bg-accent-500/10 glow-accent'
                  : 'border-yellow-500/30 bg-yellow-500/10'
              }`}
            >
              <div className="flex items-center gap-4 mb-6">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    !certFromId.isRevoked ? 'bg-accent-500/20' : 'bg-yellow-500/20'
                  }`}
                >
                  {!certFromId.isRevoked ? (
                    <svg className="w-8 h-8 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {!certFromId.isRevoked ? 'Valid Certificate' : 'Certificate Revoked'}
                  </h2>
                  <p className={!certFromId.isRevoked ? 'text-accent-400' : 'text-yellow-400'}>
                    {!certFromId.isRevoked
                      ? 'This certificate is authentic and verified on-chain'
                      : 'This certificate was revoked by the issuing institution'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-700">
                <div>
                  <span className="text-sm text-surface-400">Certificate ID</span>
                  <p className="text-white font-mono">#{certificateIdFromUrl?.toString()}</p>
                </div>
                <div>
                  <span className="text-sm text-surface-400">Status</span>
                  <p>
                    {certFromId.isRevoked ? (
                      <span className="badge badge-warning">Revoked</span>
                    ) : (
                      <span className="badge badge-success">Active</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Certificate Details Card */}
            <div className="card">
              <h3 className="text-lg font-semibold text-white mb-4">Certificate Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-surface-400">Document Hash</span>
                  <span className="text-white font-mono text-sm">
                    {truncateHash(certFromId.documentHash, 10, 8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Student Wallet</span>
                  <span className="text-white font-mono text-sm">
                    {truncateHash(certFromId.studentWallet, 8, 6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Issuing Institution</span>
                  <span className="text-white font-mono text-sm">
                    {truncateHash(certFromId.issuingInstitution, 8, 6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Issue Date</span>
                  <span className="text-white">
                    {issueDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              {certificateIdFromUrl !== undefined && certFromId && (
                <VerificationReport
                  certificateId={certificateIdFromUrl}
                  documentHash={certFromId.documentHash}
                  studentWallet={certFromId.studentWallet}
                  institutionAddress={certFromId.issuingInstitution}
                  issueDate={certFromId.issueDate}
                  isValid={!certFromId.isRevoked}
                  isRevoked={certFromId.isRevoked}
                />
              )}
              <button
                onClick={() => setShowDetailModal(true)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Details
              </button>
              <button onClick={resetVerification} className="btn-secondary flex-1">
                Verify Another
              </button>
            </div>
          </div>

          {/* Detail Modal */}
          {certificateIdFromUrl !== undefined && certFromId && showDetailModal && (
            <CertificateDetailModal
              certificateId={certificateIdFromUrl}
              certificate={certFromId}
              onClose={() => setShowDetailModal(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-surface-950 via-primary-950/20 to-surface-950">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Verify Certificate</h1>
          <p className="text-surface-400 max-w-xl mx-auto mb-6">
            Upload a PDF certificate to verify its authenticity. The document is processed 
            locally - only the hash is checked against the blockchain.
          </p>
          <button
            onClick={() => setShowQRScanner(true)}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan QR Code
          </button>
        </div>

        {/* Upload Area */}
        <div className="max-w-2xl mx-auto">
          {state === 'idle' && (
            <div
              className={`
                relative border-2 border-dashed rounded-2xl p-12 text-center
                transition-all duration-300 cursor-pointer
                ${isDragging
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-surface-700 hover:border-surface-500 bg-surface-900/50'
                }
              `}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Drop your PDF here
              </h3>
              <p className="text-surface-400 mb-4">or click to browse</p>
              <p className="text-sm text-surface-500">
                Supports PDF files up to 50MB
              </p>
            </div>
          )}

          {/* Processing State */}
          {(state === 'hashing' || (state === 'verifying' && isVerifying)) && (
            <div className="card text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/10 mb-6">
                <svg className="w-8 h-8 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {state === 'hashing' ? 'Computing Hash...' : 'Verifying On-Chain...'}
              </h3>
              <p className="text-surface-400">
                {state === 'hashing'
                  ? 'Processing your PDF file'
                  : 'Checking certificate on zkSync Era'}
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="card border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-400 mb-1">Error</h3>
                  <p className="text-surface-300">{error}</p>
                </div>
              </div>
              <button onClick={resetVerification} className="btn-secondary mt-4 w-full">
                Try Again
              </button>
            </div>
          )}

          {/* Result State */}
          {state === 'complete' && hashResult && (
            <div className="space-y-6">
              {/* Status Card */}
              <div
                className={`card ${
                  isValid && !isRevoked
                    ? 'border-accent-500/30 bg-accent-500/10 glow-accent'
                    : isRevoked
                    ? 'border-yellow-500/30 bg-yellow-500/10'
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      isValid && !isRevoked
                        ? 'bg-accent-500/20'
                        : isRevoked
                        ? 'bg-yellow-500/20'
                        : 'bg-red-500/20'
                    }`}
                  >
                    {isValid && !isRevoked ? (
                      <svg className="w-8 h-8 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isRevoked ? (
                      <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {isValid && !isRevoked
                        ? 'Valid Certificate'
                        : isRevoked
                        ? 'Certificate Revoked'
                        : 'Certificate Not Found'}
                    </h2>
                    <p className={isValid && !isRevoked ? 'text-accent-400' : isRevoked ? 'text-yellow-400' : 'text-red-400'}>
                      {isValid && !isRevoked
                        ? 'This certificate is authentic and verified on-chain'
                        : isRevoked
                        ? 'This certificate was revoked by the issuing institution'
                        : 'This certificate was not found in the blockchain registry'}
                    </p>
                  </div>
                </div>

                {certificateId !== undefined && certificateId > 0n && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-surface-700">
                    <div>
                      <span className="text-sm text-surface-400">Certificate ID</span>
                      <p className="text-white font-mono">#{certificateId?.toString()}</p>
                    </div>
                    <div>
                      <span className="text-sm text-surface-400">Status</span>
                      <p>
                        {isRevoked ? (
                          <span className="badge badge-warning">Revoked</span>
                        ) : (
                          <span className="badge badge-success">Active</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* File Details Card */}
              <div className="card">
                <h3 className="text-lg font-semibold text-white mb-4">Document Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-surface-400">File Name</span>
                    <span className="text-white">{hashResult.fileName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">File Size</span>
                    <span className="text-white">{formatFileSize(hashResult.fileSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400">Pages</span>
                    <span className="text-white">{hashResult.pageCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-surface-400">Document Hash</span>
                    <span className="text-white font-mono text-sm">
                      {truncateHash(hashResult.hash, 10, 8)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                {isValid && certificateId !== undefined && certificateId > 0n && (
                  <>
                    <VerificationReport
                      certificateId={certificateId!}
                      documentHash={hashResult.hash}
                      studentWallet={certFromPdfVerification?.studentWallet || '0x'}
                      institutionAddress={certFromPdfVerification?.issuingInstitution || '0x'}
                      issueDate={certFromPdfVerification?.issueDate || 0n}
                      isValid={isValid}
                      isRevoked={isRevoked}
                    />
                    <button
                      onClick={() => setShowDetailModal(true)}
                      disabled={isLoadingCertFromPdf || !certFromPdfVerification}
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingCertFromPdf ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          View Details
                        </>
                      )}
                    </button>
                  </>
                )}
                <button onClick={resetVerification} className="btn-secondary flex-1">
                  Verify Another Certificate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && <QRScanner onClose={() => setShowQRScanner(false)} />}

      {/* Certificate Detail Modal - for PDF upload verification */}
      {showDetailModal && certificateId !== undefined && certificateId > 0n && certFromPdfVerification && (
        <CertificateDetailModal
          certificateId={certificateId}
          certificate={certFromPdfVerification}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
}

export default Verify;


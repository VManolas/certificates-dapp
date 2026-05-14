// src/pages/Verify.tsx
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { generatePDFHash, formatFileSize, truncateHash, type HashResult } from '@/lib/pdfHash';
import { useCertificateVerification, useHashExists, useCertificateDetails } from '@/hooks';
import { useVerificationHistory } from '@/hooks/useVerificationHistory';
import { useAuthStore, useEffectiveRole, useIsAuthenticated } from '@/store/authStore';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import { QRScanner } from '@/components/QRScanner';
import { VerificationReport } from '@/components/VerificationReport';
import { CertificateDetailModal } from '@/components/CertificateDetailModal';
import { UnifiedLoginModal } from '@/components/UnifiedLoginModal';
import { validatePdfFile, globalRateLimiter } from '@/lib/sanitization';
import { parseError, withRetry } from '@/lib/errorHandling';
import { logger } from '@/lib/logger';
import type { UserRole } from '@/types/auth';
import { verifyVerificationToken } from '@/lib/verificationToken';

type VerificationState = 'idle' | 'hashing' | 'verifying' | 'complete' | 'verifying-id';

export function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const certIdParam = searchParams.get('cert');
  const hashParam = searchParams.get('hash');
  const verificationTokenParam = searchParams.get('v');
  const { isConnected } = useAccount();
  const { preSelectedRole, setPreSelectedRole } = useAuthStore();
  const effectiveRole = useEffectiveRole();
  const isAuthenticated = useIsAuthenticated();
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
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isSecurityUpdateExpanded, setIsSecurityUpdateExpanded] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [verificationTokenSigner, setVerificationTokenSigner] = useState<string | null>(null);
  const [verificationTokenAuthError, setVerificationTokenAuthError] = useState<string | null>(null);
  
  // Start login directly from employer role for disconnected/unknown wallets.
  const [showLoginModal, setShowLoginModal] = useState(false);

  const openEmployerLogin = () => {
    if (!isConnected) {
      setPreSelectedRole('employer' as UserRole);
      setShowLoginModal(true);
    }
  };

  // Handle successful login
  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    // User can now proceed with verification
  };

  // Security hardening:
  // - Public verification uses signed token links (`?v=...`)
  // - Hash links (`?hash=`) are allowed only for authenticated internal flows
  // - Legacy cert-id links (`?cert=`) are blocked
  const hashFromUrl =
    hashParam && /^0x[a-fA-F0-9]{64}$/.test(hashParam)
      ? (hashParam.toLowerCase() as `0x${string}`)
      : undefined;
  const tokenValidation = useMemo(
    () => (verificationTokenParam ? verifyVerificationToken(verificationTokenParam) : null),
    [verificationTokenParam]
  );
  const hashFromToken = tokenValidation?.valid ? tokenValidation.payload?.h : undefined;
  const hasLegacyCertParam = !!certIdParam;
  const canUseInternalHashMode = isConnected && isAuthenticated && !!effectiveRole;

  // Legacy cert-id link verification is intentionally disabled (`cert` URLs are rejected in effects).
  // Keep this explicitly undefined so legacy IDs never activate the certificate-by-id path.
  const certificateIdFromUrl: bigint | undefined = undefined;
  const {
    certificate: certFromId,
    isLoading: isLoadingCertById,
    error: certByIdError,
  } = useCertificateDetails(certificateIdFromUrl, !!certificateIdFromUrl);

  // Initialize state from secure token links (`?v=...`).
  // Keep this effect independent from auth/role state so token verification
  // does not reset when auth state updates in the background.
  useEffect(() => {
    if (!verificationTokenParam) {
      return;
    }

    if (!tokenValidation?.valid || !hashFromToken) {
      setError(tokenValidation?.reason || 'Invalid verification token');
      setState('idle');
      setHashResult(null);
      return;
    }

    setVerificationTokenSigner(tokenValidation.signer || null);
    setVerificationTokenAuthError(null);
    setError(null);
    setHashResult({
      hash: hashFromToken,
      fileName: 'Secure Verification Link',
      fileSize: 0,
      pageCount: 0,
    });
    setHasLoggedVerification(false);
    setState('verifying');
  }, [verificationTokenParam, tokenValidation, hashFromToken]);

  // Initialize state from hash/legacy URL params when no token param exists.
  useEffect(() => {
    if (verificationTokenParam) {
      return;
    }

    if (hashFromUrl) {
      if (!canUseInternalHashMode) {
        setError('Public hash links are disabled. Please use a secure verification link token (v=...).');
        setState('idle');
        setHashResult(null);
        return;
      }
      setVerificationTokenSigner(null);
      setVerificationTokenAuthError(null);
      setError(null);
      setHashResult({
        hash: hashFromUrl,
        fileName: 'Verification Link',
        fileSize: 0,
        pageCount: 0,
      });
      setHasLoggedVerification(false);
      setState('verifying');
      return;
    }

    if (hashParam && !hashFromUrl) {
      setError('Invalid verification link format. Hash must be a 32-byte hex value.');
      setState('idle');
      return;
    }

    if (hasLegacyCertParam) {
      setError('Legacy certificate-ID links are no longer supported. Please request a new secure verification link.');
      setState('idle');
    }
  }, [verificationTokenParam, hashFromUrl, hashParam, hasLegacyCertParam, canUseInternalHashMode]);

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
    refetch: refetchVerification,
    verificationTimestamp,
    verificationId,
  } = useCertificateVerification(
    hashResult?.hash,
    state === 'verifying'
  );

  // 🔍 DEBUG: Log verification state changes
  useEffect(() => {
    if (hashResult) {
    }
  }, [state, hashResult, isValid, isRevoked, certificateId, isVerifying, verifyError, verificationId, verificationTimestamp]);

  // Fetch full certificate details when we have a certificateId from PDF verification
  const {
    certificate: certFromPdfVerification,
    isLoading: isLoadingCertFromPdf,
  } = useCertificateDetails(
    certificateId && certificateId > 0n ? certificateId : undefined,
    state === 'complete' && !!certificateId && certificateId > 0n
  );

  // For signed links, enforce that signer is certificate student or issuing institution.
  useEffect(() => {
    if (!verificationTokenSigner || !certFromPdfVerification || state !== 'complete') {
      setVerificationTokenAuthError(null);
      return;
    }

    const signer = verificationTokenSigner.toLowerCase();
    const isAuthorizedSigner =
      signer === certFromPdfVerification.studentWallet.toLowerCase() ||
      signer === certFromPdfVerification.issuingInstitution.toLowerCase();

    if (!isAuthorizedSigner) {
      setVerificationTokenAuthError('This verification token is not authorized for this certificate.');
    } else {
      setVerificationTokenAuthError(null);
    }
  }, [verificationTokenSigner, certFromPdfVerification, state]);

  // Fix: Update state when verification completes (using useEffect instead of imperative setState)
  useEffect(() => {
    if (state === 'verifying' && !isVerifying && !isCheckingHash) {
      if (isValid !== undefined || verifyError) {
        setState('complete');
      }
    }
  }, [state, isVerifying, isCheckingHash, isValid, verifyError]);

  // Log verification to history (for employer role only)
  useEffect(() => {
    if (effectiveRole === 'employer' && state === 'complete' && !hasLoggedVerification && hashResult) {
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
  }, [effectiveRole, state, isValid, isRevoked, certificateId, hashResult, hasLoggedVerification, addEntry]);

  // Log certificate ID verification to history
  useEffect(() => {
    if (effectiveRole === 'employer' && state === 'verifying-id' && !hasLoggedVerification && certFromId && !isLoadingCertById) {
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
  }, [effectiveRole, state, certFromId, certificateIdFromUrl, isLoadingCertById, hasLoggedVerification, addEntry]);

  const handleFile = useCallback(async (selectedFile: File) => {
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
    // Clear verification state without full page reload
    setFile(null);
    setHashResult(null);
    setState('idle');
    setError(null);
    setHasLoggedVerification(false);
    setShowDetailModal(false);
    
    // Clear React Query cache for certificate data
    queryClient.removeQueries({ queryKey: ['readContract'] });
    
    // If there's a cert parameter in URL, navigate to clean /verify route
    if (certIdParam) {
      navigate('/verify', { replace: true });
    }
  };

  const handleLinkSubmit = () => {
    const trimmedLink = linkInput.trim();
    if (!trimmedLink) {
      setError('Please enter a verification link');
      return;
    }

    try {
      // Extract signed token/document hash from various link formats
      let extractedToken: string | null = null;
      let extractedHash: string | null = null;

      // Try to parse as URL
      try {
        const url = new URL(trimmedLink);
        extractedToken = url.searchParams.get('v');
        extractedHash = url.searchParams.get('hash');
        if (!extractedHash && url.searchParams.get('cert')) {
          setError('Legacy certificate-ID links are no longer supported. Please request a new secure verification link.');
          return;
        }
      } catch {
        // Raw token paste
        if (trimmedLink.startsWith('v1.')) {
          extractedToken = trimmedLink;
        }

        // Not a valid URL, try to extract hash token from text
        const match = trimmedLink.match(/hash[=:](0x[a-fA-F0-9]{64})/i);
        if (match) {
          extractedHash = match[1];
        }
      }

      if (!extractedToken) {
        const tokenMatch = trimmedLink.match(/(?:\?|&)v=([^&\s]+)/);
        if (tokenMatch) {
          extractedToken = decodeURIComponent(tokenMatch[1]);
        }
      }

      if (extractedToken) {
        const decodedToken = decodeURIComponent(extractedToken);
        const tokenResult = verifyVerificationToken(decodedToken);
        if (!tokenResult.valid) {
          setError(tokenResult.reason || 'Invalid verification token');
          return;
        }
        logger.info('Navigating to token-based certificate verification');
        navigate(`/verify?v=${encodeURIComponent(decodedToken)}`);
        setShowLinkInput(false);
        setLinkInput('');
        setError(null);
        return;
      }

      if (!extractedHash && /^0x[a-fA-F0-9]{64}$/.test(trimmedLink)) {
        extractedHash = trimmedLink;
      }

      if (!extractedHash || !/^0x[a-fA-F0-9]{64}$/.test(extractedHash)) {
        setError('Invalid verification link format. Please paste a valid link containing v=... or hash=0x....');
        return;
      }

      if (!canUseInternalHashMode) {
        setError('Public hash links are disabled. Please paste a secure verification link containing v=....');
        return;
      }

      logger.info('Navigating to hash-based certificate verification');
      // Navigate to the verify page with hash parameter
      navigate(`/verify?hash=${extractedHash.toLowerCase()}`);
      setShowLinkInput(false);
      setLinkInput('');
      setError(null);
    } catch (err) {
      logger.error('Error parsing verification link', err);
      setError('Failed to parse verification link. Please check the format.');
    }
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
            {/* Navigation Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="btn-secondary flex items-center gap-2"
                title="Go back to previous page"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              {effectiveRole === 'university' && (
                <button
                  onClick={() => navigate('/university/dashboard')}
                  className="btn-primary flex items-center gap-2"
                  title="Go to University Dashboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </button>
              )}
            </div>

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
      {/* Unified Login Modal */}
      <UnifiedLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        preSelectedRole={preSelectedRole}
      />

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Verify Certificate</h1>
          <p className="text-surface-400 max-w-xl mx-auto mb-6">
            Upload a PDF certificate to verify its authenticity. The document is processed 
            locally - only the hash is checked against the blockchain.
          </p>
          <button
            type="button"
            onClick={() => setIsSecurityUpdateExpanded((prev) => !prev)}
            aria-expanded={isSecurityUpdateExpanded}
            className="max-w-2xl w-full mx-auto mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-left transition-colors hover:bg-blue-500/15"
          >
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                {!isSecurityUpdateExpanded ? (
                  <p className="text-sm text-blue-200">
                    <strong className="text-white">Security update:</strong> public verification links now require a secure token
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-blue-200">
                      <strong className="text-white">Security update:</strong> public verification links now require a secure token
                      (<span className="font-mono">verify?hash=...</span>) to protect against certificate enumeration.
                    </p>
                    <p className="text-xs text-surface-300 mt-1">
                      Internal authenticated users can still use hash-based links for operational workflows.
                    </p>
                  </>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-blue-300 mt-1 transition-transform ${isSecurityUpdateExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          <div className="flex items-center justify-center gap-3">
            {!isConnected && (
              <button
                onClick={openEmployerLogin}
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Login
              </button>
            )}
            <button
              onClick={() => setShowQRScanner(true)}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Scan QR Code
            </button>
            <button
              onClick={() => setShowLinkInput(true)}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Paste Verification Link
            </button>
          </div>
        </div>

        {/* Link Input Modal */}
        {showLinkInput && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-900 rounded-2xl shadow-2xl max-w-lg w-full border border-surface-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Paste Verification Link</h2>
                  <button
                    onClick={() => {
                      setShowLinkInput(false);
                      setLinkInput('');
                      setError(null);
                    }}
                    className="text-surface-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="link-input" className="block text-sm font-medium text-surface-300 mb-2">
                      Verification Link or Certificate ID
                    </label>
                    <input
                      id="link-input"
                      type="text"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleLinkSubmit();
                        }
                      }}
                      placeholder={
                        canUseInternalHashMode
                          ? 'https://example.com/verify?v=... or ?hash=0x...'
                          : 'https://example.com/verify?v=...'
                      }
                      className="input w-full"
                      autoFocus
                    />
                    <p className="text-xs text-surface-500 mt-2">
                      {canUseInternalHashMode
                        ? 'Paste a secure token link (`v`) or internal hash link (`hash`)'
                        : 'Paste a secure token link (`v`)'}
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowLinkInput(false);
                        setLinkInput('');
                        setError(null);
                      }}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLinkSubmit}
                      disabled={!linkInput.trim()}
                      className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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

          {/* Error State - Enhanced with retry and details */}
          {error && (
            <div className="card border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-400 mb-1">Verification Error</h3>
                  <p className="text-surface-300 mb-3">{error}</p>
                  
                  {/* Technical Details */}
                  {hashResult && (
                    <details className="text-xs text-surface-400 mb-3">
                      <summary className="cursor-pointer hover:text-surface-300 mb-2">Technical Details</summary>
                      <div className="mt-2 p-3 bg-surface-900/50 rounded font-mono space-y-1">
                        <div><span className="text-surface-500">Document Hash:</span> {truncateHash(hashResult.hash, 12, 10)}</div>
                        <div><span className="text-surface-500">Network:</span> zkSync Era</div>
                        <div><span className="text-surface-500">Contract:</span>{' '}
                          {CERTIFICATE_REGISTRY_ADDRESS
                            ? truncateHash(CERTIFICATE_REGISTRY_ADDRESS, 10, 8)
                            : 'Not configured'}
                        </div>
                        {verifyError && <div><span className="text-surface-500">Error Type:</span> {verifyError.message}</div>}
                      </div>
                    </details>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                {hashResult && (
                  <button 
                    onClick={() => {
                      setError(null);
                      setState('verifying');
                      refetchVerification();
                    }} 
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Retry Verification
                  </button>
                )}
                <button onClick={resetVerification} className="btn-secondary flex-1">
                  Try Different PDF
                </button>
              </div>
            </div>
          )}

          {/* Result State */}
          {state === 'complete' && hashResult && (
            <div className="space-y-6">
              {verificationTokenAuthError && (
                <div className="card border-red-500/30 bg-red-500/10">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-400 mb-1">Unauthorized Verification Link</h3>
                      <p className="text-surface-300">{verificationTokenAuthError}</p>
                      <p className="text-surface-400 text-sm mt-2">
                        Request a new verification link shared by the certificate holder or issuing institution.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(-1)}
                  className="btn-secondary flex items-center gap-2"
                  title="Go back to previous page"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                {effectiveRole === 'university' && (
                  <button
                    onClick={() => navigate('/university/dashboard')}
                    className="btn-primary flex items-center gap-2"
                    title="Go to University Dashboard"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Dashboard
                  </button>
                )}
              </div>

              {/* Status Card */}
              {!verificationTokenAuthError && (
              <div
                className={`card ${
                  isValid && !isRevoked && certificateId !== undefined && certificateId > 0n
                    ? 'border-accent-500/30 bg-accent-500/10 glow-accent'
                    : isRevoked
                    ? 'border-yellow-500/30 bg-yellow-500/10'
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      isValid && !isRevoked && certificateId !== undefined && certificateId > 0n
                        ? 'bg-accent-500/20'
                        : isRevoked
                        ? 'bg-yellow-500/20'
                        : 'bg-red-500/20'
                    }`}
                  >
                    {isValid && !isRevoked && certificateId !== undefined && certificateId > 0n ? (
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
                      {isValid && !isRevoked && certificateId !== undefined && certificateId > 0n
                        ? 'Valid Certificate'
                        : isRevoked
                        ? 'Certificate Revoked'
                        : 'Certificate Not Found'}
                    </h2>
                    <p className={isValid && !isRevoked && certificateId !== undefined && certificateId > 0n ? 'text-accent-400' : isRevoked ? 'text-yellow-400' : 'text-red-400'}>
                      {isValid && !isRevoked && certificateId !== undefined && certificateId > 0n
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
              )}

              {/* File Details Card */}
              {!verificationTokenAuthError && (
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
              )}

              {/* Blockchain Verification Status Card */}
              {!verificationTokenAuthError && (
              <div className="card bg-surface-800 border-surface-700">
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-white">Blockchain Verification</h3>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-400">Network</span>
                    <span className="text-white font-mono">zkSync Era</span>
                  </div>
                  
                  {CERTIFICATE_REGISTRY_ADDRESS ? (
                  <div className="flex justify-between">
                    <span className="text-surface-400">Smart Contract</span>
                    <a 
                      href={`https://explorer.zksync.io/address/${CERTIFICATE_REGISTRY_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-400 hover:text-accent-300 font-mono text-xs underline transition-colors"
                      title="View contract on zkSync Era Block Explorer"
                    >
                      {truncateHash(CERTIFICATE_REGISTRY_ADDRESS, 8, 6)}
                    </a>
                  </div>
                  ) : (
                  <div className="flex justify-between">
                    <span className="text-surface-400">Smart Contract</span>
                    <span className="text-surface-500 text-xs">Not configured</span>
                  </div>
                  )}
                  
                  {verificationTimestamp && (
                    <div className="flex justify-between">
                      <span className="text-surface-400">Verified At</span>
                      <span className="text-white">
                        {verificationTimestamp.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-3 border-t border-surface-700">
                    <span className="text-surface-400">Query Status</span>
                    <span className="flex items-center gap-2 text-accent-400">
                      <span className="w-2 h-2 rounded-full bg-accent-400"></span>
                      On-Chain Verified
                    </span>
                  </div>

                  {verificationId && (
                    <div className="flex justify-between text-xs pt-2 border-t border-surface-700/50">
                      <span className="text-surface-500">Verification ID</span>
                      <span className="text-surface-400 font-mono">{verificationId.split('-')[1]}</span>
                    </div>
                  )}
                </div>
              </div>
              )}

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

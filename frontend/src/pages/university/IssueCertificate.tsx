// src/pages/university/IssueCertificate.tsx
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { generatePDFHash, formatFileSize, type HashResult } from '@/lib/pdfHash';
import { useCertificateIssuanceWithCallback, useCanIssueCertificates } from '@/hooks';
import { logger } from '@/lib/logger';
import { sanitizeAddress, validatePdfFile, globalRateLimiter } from '@/lib/sanitization';
import { parseError, withRetry } from '@/lib/errorHandling';
import { decodeContractError } from '@/lib/errorDecoding';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';

const CERTIFICATE_REGISTRY_ADDRESS = import.meta.env.VITE_CERTIFICATE_REGISTRY_ADDRESS as `0x${string}`;

type FormState = 'upload' | 'details' | 'confirm' | 'submitting' | 'success';

export function IssueCertificate() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { refetchInstitution } = useAuthStore();
  
  // Real-time institution status check
  const { canIssue, isLoading: isCheckingStatus, reason, refetch: refetchStatus } = useCanIssueCertificates();
  
  const [formState, setFormState] = useState<FormState>('upload');
  const [hashResult, setHashResult] = useState<HashResult | null>(null);
  const [studentWallet, setStudentWallet] = useState('');
  const [program, setProgram] = useState('');
  const [graduationYear, setGraduationYear] = useState(new Date().getFullYear());
  const [walletError, setWalletError] = useState<string | null>(null);
  const [programError, setProgramError] = useState<string | null>(null);
  const [yearError, setYearError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bypassDuplicateCheck, setBypassDuplicateCheck] = useState(false);

  // Frontend duplicate check
  const { data: isDuplicateOnChain, isLoading: isCheckingDuplicate } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'hashExists',
    args: hashResult?.hash ? [hashResult.hash] : undefined,
    query: {
      enabled: !!hashResult?.hash && !!CERTIFICATE_REGISTRY_ADDRESS && formState === 'confirm',
      refetchOnMount: 'always',
      staleTime: 0,
    },
  });

  // Use the certificate issuance hook with callbacks
  const { 
    issueCertificate, 
    isPending, 
    isConfirming,
    isSuccess,
    transactionPhase,
    error: txError,
    certificateId,
    transactionHash,
    reset 
  } = useCertificateIssuanceWithCallback(
    (hash, certId) => {
      logger.transaction('Certificate issued successfully', hash, {
        certificateId: certId?.toString(),
      });
      setFormState('success');
      setError(null);
      // Refetch institution data to update totalCertificatesIssued counter
      if (refetchInstitution) {
        setTimeout(() => refetchInstitution(), 1000);
      }
    },
    (err) => {
      logger.error('Failed to issue certificate', err);
      
      // Enhanced debugging
      if (import.meta.env.DEV) {
        logger.debug('Raw error object', { 
          error: err,
          errorType: err?.constructor?.name,
          errorMessage: err?.message,
          errorKeys: Object.keys(err || {})
        });
        if (err && typeof err === 'object' && 'cause' in err) {
          logger.debug('Error cause', { cause: (err as any).cause });
        }
        if (err && typeof err === 'object' && 'data' in err) {
          logger.debug('Error data', { data: (err as any).data });
        }
      }
      
      // Decode the error with enhanced duplicate detection
      const userFriendlyError = decodeContractError(err);
      
      logger.debug('Decoded error', { userFriendlyError });
      
      setError(userFriendlyError);
      setFormState('confirm');
    }
  );

  // Monitor transaction state and auto-transition to success if needed
  useEffect(() => {
    logger.debug('Transaction state update', {
      formState,
      isSuccess,
      isPending,
      isConfirming,
      hasHash: !!transactionHash,
      hasCertId: certificateId !== undefined,
    });
    
    if (isSuccess && formState === 'submitting') {
      logger.info('Transaction succeeded, updating UI state');
      setFormState('success');
      setError(null);
    }
  }, [isSuccess, formState, isPending, isConfirming, transactionHash, certificateId]);

  // If transaction is no longer pending/confirming but we're stuck in submitting state without success or error, revert to confirm
  useEffect(() => {
    // Only revert if we're truly stuck: not pending, not confirming, not successful, and no error has been set
    if (formState === 'submitting' && !isPending && !isConfirming && !isSuccess && !error) {
      logger.warn('Transaction stopped unexpectedly without success or error, reverting to confirm');
      setFormState('confirm');
    }
  }, [formState, isPending, isConfirming, isSuccess, error]);

  const transactionStatusConfig: Record<'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed', {
    title: string;
    description: string;
    borderClassName: string;
    textClassName: string;
  }> = {
    awaiting_wallet_confirmation: {
      title: 'Waiting to submit transaction',
      description: 'Confirm this certificate issuance in MetaMask to broadcast the transaction.',
      borderClassName: 'border-yellow-500/30 bg-yellow-500/10',
      textClassName: 'text-yellow-300',
    },
    pending_onchain: {
      title: 'Transaction pending',
      description: 'The issuance transaction was submitted and is waiting for blockchain confirmation.',
      borderClassName: 'border-blue-500/30 bg-blue-500/10',
      textClassName: 'text-blue-300',
    },
    confirmed: {
      title: 'Transaction confirmed',
      description: 'The certificate issuance transaction is now confirmed on-chain.',
      borderClassName: 'border-green-500/30 bg-green-500/10',
      textClassName: 'text-green-300',
    },
  };

  const showTransactionStatus =
    transactionPhase === 'awaiting_wallet_confirmation'
    || transactionPhase === 'pending_onchain'
    || transactionPhase === 'confirmed';

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    
    // Validate file before processing
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid PDF file');
      logger.warn('PDF validation failed', { fileName: file.name, error: validation.error });
      return;
    }

    try {
      logger.debug('Processing PDF file', { fileName: file.name, size: file.size });
      
      // Use retry logic for hash generation
      const result = await withRetry(
        () => generatePDFHash(file),
        { maxAttempts: 2, delayMs: 1000 }
      );
      
      setHashResult(result);
      setFormState('details');
      logger.userAction('PDF processed successfully', { fileName: file.name });
    } catch (err) {
      const errorResponse = parseError(err);
      setError(errorResponse.message);
      logger.error('Failed to process PDF', err);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const validateWallet = (address: string): boolean => {
    if (!address) {
      setWalletError('Student wallet address is required');
      return false;
    }
    
    // Use sanitization utility
    const sanitized = sanitizeAddress(address);
    if (!sanitized) {
      setWalletError('Invalid Ethereum address format');
      logger.warn('Invalid wallet address provided', { address });
      return false;
    }
    
    // Update the wallet with sanitized value
    if (sanitized !== address) {
      setStudentWallet(sanitized);
    }
    
    setWalletError(null);
    return true;
  };

  const validateProgram = (programName: string): boolean => {
    const trimmedProgram = programName.trim();
    
    if (!trimmedProgram) {
      setProgramError('Program name is required');
      return false;
    }
    
    if (trimmedProgram.length < 3) {
      setProgramError('Program name must be at least 3 characters');
      return false;
    }
    
    if (trimmedProgram.length > 200) {
      setProgramError('Program name must be less than 200 characters');
      return false;
    }
    
    // Update the program with trimmed value
    if (trimmedProgram !== programName) {
      setProgram(trimmedProgram);
    }
    
    setProgramError(null);
    return true;
  };

  const validateYear = (year: number): boolean => {
    if (!year) {
      setYearError('Graduation year is required');
      return false;
    }
    
    if (!Number.isInteger(year)) {
      setYearError('Graduation year must be a valid integer');
      return false;
    }
    
    if (year < 1900 || year > 2100) {
      setYearError('Graduation year must be between 1900 and 2100');
      logger.warn('Invalid graduation year provided', { year });
      return false;
    }
    
    setYearError(null);
    return true;
  };

  const handleSubmit = async () => {
    if (!hashResult || !validateWallet(studentWallet) || !validateProgram(program) || !validateYear(graduationYear)) return;

    // Prevent double submissions
    if (isPending || isConfirming) {
      logger.warn('Transaction already in progress, ignoring duplicate submit');
      return;
    }

    // CRITICAL: Real-time authorization check before submission
    if (!canIssue) {
      setError(reason || 'Your institution cannot issue certificates at this time. Please contact an administrator.');
      logger.warn('Certificate issuance blocked: institution cannot issue', { reason });
      return;
    }

    // Frontend duplicate check (unless user has explicitly bypassed it)
    if (!bypassDuplicateCheck && isDuplicateOnChain) {
      logger.warn('Certificate duplicate detected on frontend', { documentHash: hashResult.hash });
      setError('frontend-duplicate'); // Special error flag
      return;
    }

    // Rate limiting check
    if (!globalRateLimiter.isAllowed('certificate-issue')) {
      const remaining = globalRateLimiter.getRemainingAttempts('certificate-issue');
      setError(`Rate limit exceeded. Please wait before issuing another certificate. Remaining attempts: ${remaining}`);
      logger.warn('Certificate issuance rate limited', { studentWallet });
      return;
    }

    // IMPORTANT: Reset transaction state BEFORE starting new one
    // This clears any lingering success/error states from previous transactions
    reset();
    
    // Wait a tick to ensure reset propagates through React state
    await new Promise(resolve => setTimeout(resolve, 50));
    
    setFormState('submitting');
    setError(null);
    setBypassDuplicateCheck(false); // Reset bypass flag
    
    try {
      const sanitizedWallet = sanitizeAddress(studentWallet);
      if (!sanitizedWallet) {
        throw new Error('Invalid wallet address');
      }

      logger.userAction('Issuing certificate', {
        documentHash: hashResult.hash,
        studentWallet: sanitizedWallet,
        program: program.trim(),
        graduationYear,
        bypassedDuplicateCheck: bypassDuplicateCheck,
      });

      // Create metadata URI with program information
      // Format: JSON string with program info
      const metadata = JSON.stringify({
        program: program.trim(),
        timestamp: Date.now(),
      });

      // Issue the certificate
      await issueCertificate({
        documentHash: hashResult.hash,
        studentWallet: sanitizedWallet,
        metadataURI: metadata,
        graduationYear,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue certificate');
      setFormState('confirm');
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-surface-400">Please connect your wallet to issue certificates.</p>
      </div>
    );
  }

  // Show loading state while checking institution status
  if (isCheckingStatus) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
        <p className="text-surface-400">Verifying institution status...</p>
      </div>
    );
  }

  // CRITICAL: Block UI if institution cannot issue certificates
  if (!canIssue) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="card border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">Certificate Issuance Unavailable</h2>
              <p className="text-red-400 mb-4">{reason}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate('/university/dashboard')} 
                  className="btn-secondary"
                >
                  Back to Dashboard
                </button>
                <button 
                  onClick={() => {
                    refetchStatus();
                    if (refetchInstitution) refetchInstitution();
                  }}
                  className="btn-primary"
                >
                  Refresh Status
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Issue Certificate</h1>
        <p className="text-surface-400">
          Upload a PDF certificate and assign it to a student's wallet address
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {['Upload', 'Details', 'Confirm'].map((step, i) => {
          const stepNum = i + 1;
          const isActive = 
            (formState === 'upload' && stepNum === 1) ||
            (formState === 'details' && stepNum === 2) ||
            (['confirm', 'submitting', 'success'].includes(formState) && stepNum === 3);
          const isComplete = 
            (stepNum === 1 && formState !== 'upload') ||
            (stepNum === 2 && ['confirm', 'submitting', 'success'].includes(formState)) ||
            (stepNum === 3 && formState === 'success');

          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? 'bg-accent-500 text-white'
                    : isActive
                    ? 'bg-primary-500 text-white'
                    : 'bg-surface-700 text-surface-400'
                }`}
              >
                {isComplete ? '✓' : stepNum}
              </div>
              <span className={isActive ? 'text-white' : 'text-surface-400'}>{step}</span>
              {i < 2 && <div className="w-8 h-px bg-surface-700" />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Upload */}
      {formState === 'upload' && (
        <div
          className="card border-2 border-dashed border-surface-700 hover:border-surface-500 transition-colors cursor-pointer text-center py-12"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="hidden"
            id="pdf-upload"
          />
          <label htmlFor="pdf-upload" className="cursor-pointer">
            <div className="text-6xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-white mb-2">Upload Certificate PDF</h3>
            <p className="text-surface-400">Drag and drop or click to browse</p>
          </label>
          {error && <p className="text-red-400 mt-4">{error}</p>}
        </div>
      )}

      {/* Step 2: Details */}
      {formState === 'details' && hashResult && (
        <div className="space-y-6">
          {/* File Info */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Document</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary-500/10 flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{hashResult.fileName}</p>
                <p className="text-surface-400 text-sm">
                  {formatFileSize(hashResult.fileSize)} • {hashResult.pageCount} pages
                </p>
              </div>
              <button
                onClick={() => setFormState('upload')}
                className="text-surface-400 hover:text-white"
              >
                Change
              </button>
            </div>
          </div>

          {/* Student Wallet */}
          <div className="card">
            <label className="label">Student Wallet Address</label>
            <input
              type="text"
              value={studentWallet}
              onChange={(e) => {
                setStudentWallet(e.target.value);
                setWalletError(null);
              }}
              placeholder="0x..."
              className={`input font-mono ${walletError ? 'border-red-500' : ''}`}
            />
            {walletError && <p className="text-red-400 text-sm mt-2">{walletError}</p>}
          </div>

          {/* Program Name */}
          <div className="card">
            <label className="label">Program Name</label>
            <input
              type="text"
              value={program}
              onChange={(e) => {
                setProgram(e.target.value);
                setProgramError(null);
              }}
              placeholder="e.g., MSc Cybersecurity, Bachelor of Science in Computer Science"
              className={`input ${programError ? 'border-red-500' : ''}`}
            />
            {programError && <p className="text-red-400 text-sm mt-2">{programError}</p>}
            <p className="text-surface-400 text-xs mt-2">
              Enter the full name of the degree or certificate program
            </p>
          </div>

          {/* Graduation Year */}
          <div className="card">
            <label className="label">Graduation Year</label>
            <input
              type="number"
              value={graduationYear}
              onChange={(e) => {
                const year = parseInt(e.target.value);
                setGraduationYear(year);
                setYearError(null);
              }}
              placeholder="2024"
              min={1900}
              max={2100}
              className={`input ${yearError ? 'border-red-500' : ''}`}
            />
            {yearError && <p className="text-red-400 text-sm mt-2">{yearError}</p>}
            <p className="text-surface-400 text-xs mt-2">
              Enter the year the student graduated (1900-2100)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button onClick={() => setFormState('upload')} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={() => validateWallet(studentWallet) && validateProgram(program) && validateYear(graduationYear) && setFormState('confirm')}
              className="btn-primary flex-1"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {(formState === 'confirm' || formState === 'submitting') && hashResult && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Review & Confirm</h3>
            
            <div className="space-y-4">
              <div>
                <span className="text-surface-400 text-sm">Document</span>
                <p className="text-white">{hashResult.fileName}</p>
              </div>
              <div>
                <span className="text-surface-400 text-sm">Document Hash</span>
                <p className="text-white font-mono text-sm break-all">{hashResult.hash}</p>
              </div>
              <div>
                <span className="text-surface-400 text-sm">Student Wallet</span>
                <p className="text-white font-mono text-sm">{studentWallet}</p>
              </div>
              <div>
                <span className="text-surface-400 text-sm">Program</span>
                <p className="text-white">{program}</p>
              </div>
              <div>
                <span className="text-surface-400 text-sm">Graduation Year</span>
                <p className="text-white">{graduationYear}</p>
              </div>
            </div>
          </div>

          {/* Transaction Status */}
          {showTransactionStatus && (
            <div className={`card ${transactionStatusConfig[transactionPhase].borderClassName}`}>
              <p className={`font-medium flex items-center gap-2 ${transactionStatusConfig[transactionPhase].textClassName}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {transactionStatusConfig[transactionPhase].title}
              </p>
              <p className="mt-1 text-sm text-surface-300">
                {transactionStatusConfig[transactionPhase].description}
              </p>
              {transactionHash && (
                <p className="mt-2 text-xs text-surface-400 font-mono break-all">
                  Transaction: {transactionHash}
                </p>
              )}
            </div>
          )}

          {/* Frontend Duplicate Check Warning */}
          {isCheckingDuplicate ? (
            <div className="card border-blue-500/30 bg-blue-500/10" key="duplicate-check">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                <p className="text-blue-300 text-sm">Checking if certificate already exists on blockchain...</p>
              </div>
            </div>
          ) : null}

          {error === 'frontend-duplicate' && isDuplicateOnChain ? (
            <div className="card border-yellow-500/30 bg-yellow-500/10">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-yellow-400 font-semibold mb-2">⚠️ Duplicate Certificate Detected (Frontend Check)</h4>
                  <p className="text-yellow-300 text-sm mb-4">
                    This PDF document appears to already exist in the blockchain. Issuing it again will cost gas fees but will fail on-chain.
                  </p>
                  
                  <div className="space-y-3 mb-4">
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-yellow-400 text-sm font-semibold mb-1">💡 Recommended Action:</p>
                      <p className="text-yellow-300 text-sm">
                        Upload a different PDF file for this student. Each certificate must use a unique document.
                      </p>
                    </div>
                    
                    <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-yellow-400 text-sm font-semibold mb-1">🔍 Alternative Option:</p>
                      <p className="text-yellow-300 text-sm mb-2">
                        If you're certain this is a different certificate (perhaps frontend check is incorrect), you can proceed with blockchain verification.
                      </p>
                      <p className="text-yellow-200 text-xs">
                        ⚠️ Note: If the certificate truly is a duplicate, the blockchain will reject it and you'll pay gas fees for the failed transaction.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setFormState('upload');
                        setHashResult(null);
                        setError(null);
                        reset();
                      }}
                      className="btn-secondary flex-1"
                    >
                      <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Upload Different PDF
                    </button>
                    <button
                      onClick={() => {
                        setBypassDuplicateCheck(true);
                        setError(null);
                        logger.info('User chose to bypass frontend duplicate check');
                      }}
                      className="btn-primary flex-1"
                    >
                      <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Verify on Blockchain Anyway
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {error && error !== 'frontend-duplicate' && (
            <div className="card border-red-500/30 bg-red-500/10">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-red-400 font-semibold">Certificate Issuance Failed</h4>
                    
                    {/* Technical Details Tooltip - visible on hover */}
                    <div className="relative group">
                      <button
                        type="button"
                        className="text-red-400/60 hover:text-red-400 transition-colors cursor-help"
                        aria-label="View technical details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      
                      {/* Tooltip popup */}
                      <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-96 max-w-sm">
                        <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 text-xs">
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-700">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            <span className="text-gray-300 font-semibold">Technical Details</span>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <span className="text-gray-400 font-medium">Error Type:</span>
                              <pre className="mt-1 text-gray-300 whitespace-pre-wrap break-words font-mono bg-gray-800/50 p-2 rounded">
                                {txError?.name || 'Contract Error'}
                              </pre>
                            </div>
                            <div>
                              <span className="text-gray-400 font-medium">Raw Message:</span>
                              <pre className="mt-1 text-gray-300 whitespace-pre-wrap break-words font-mono bg-gray-800/50 p-2 rounded max-h-40 overflow-y-auto">
                                {txError?.message || error}
                              </pre>
                            </div>
                            <div className="text-gray-500 italic text-[10px] pt-2 border-t border-gray-700">
                              💡 Hover to view technical error details for debugging
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-red-300 text-sm mb-3">{error}</p>
                  
                  {/* Special handling for duplicate certificate error */}
                  {(error.toLowerCase().includes('already been issued') || 
                    error.toLowerCase().includes('already exists') || 
                    error.toLowerCase().includes('unique pdf')) && (
                    <div className="border border-yellow-500/30 rounded-lg p-4 mb-3" style={{ background: 'rgba(234, 179, 8, 0.1)' }}>
                      <div className="space-y-3">
                        <div>
                          <p className="text-yellow-400 text-sm font-semibold mb-1">💡 What happened?</p>
                          <p className="text-yellow-300 text-sm">
                            This PDF document has already been issued as a certificate. Each certificate must use a unique PDF file.
                          </p>
                        </div>
                        
                        <div className="border-t border-yellow-500/20 pt-3">
                          <p className="text-yellow-400 text-sm font-semibold mb-1">✅ Solution:</p>
                          <p className="text-yellow-300 text-sm">
                            Click "Upload Different PDF" below to select a different certificate document for this student.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => {
                      setFormState('upload');
                      setHashResult(null);
                      setError(null);
                      reset();
                    }}
                    className="btn-secondary text-sm w-full flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Upload Different PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => {
                setFormState('details');
                setError(null);
                setBypassDuplicateCheck(false);
              }}
              className="btn-secondary flex-1"
              disabled={formState === 'submitting'}
            >
              Back to Edit
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                isPending || 
                isConfirming || 
                isCheckingDuplicate || 
                (error === 'frontend-duplicate' && !bypassDuplicateCheck)
              }
              className="btn-primary flex-1"
            >
              {isCheckingDuplicate ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Checking...
                </>
              ) : isPending || isConfirming ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {transactionPhase === 'awaiting_wallet_confirmation'
                    ? 'Waiting for wallet confirmation...'
                    : 'Transaction pending...'}
                </>
              ) : bypassDuplicateCheck ? (
                'Verify on Blockchain'
              ) : (
                'Issue Certificate'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {formState === 'success' && (
        <div className="card border-accent-500/30 bg-accent-500/10 text-center py-12">
          <div className="w-16 h-16 rounded-full bg-accent-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Certificate Issued!</h2>
          <p className="text-surface-400 mb-6">
            The certificate has been successfully recorded on zkSync Era
          </p>
          {certificateId !== undefined && (
            <div className="mb-4 p-4 bg-surface-800/50 rounded-lg">
              <p className="text-sm text-surface-400 mb-1">Certificate ID</p>
              <p className="text-xl font-bold text-accent-400 font-mono">#{certificateId.toString()}</p>
            </div>
          )}
          <div className="flex gap-4 justify-center">
            <button onClick={() => navigate('/university/dashboard')} className="btn-secondary">
              Back to Dashboard
            </button>
            <button
              onClick={() => {
                setFormState('upload');
                setHashResult(null);
                setStudentWallet('');
                setProgram('');
                setGraduationYear(new Date().getFullYear());
                reset();
              }}
              className="btn-primary"
            >
              Issue Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default IssueCertificate;


// src/pages/university/IssueCertificate.tsx
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { generatePDFHash, formatFileSize, type HashResult } from '@/lib/pdfHash';
import { useCertificateIssuanceWithCallback } from '@/hooks';
import { logger } from '@/lib/logger';
import { sanitizeAddress, validatePdfFile, globalRateLimiter } from '@/lib/sanitization';
import { parseError, withRetry } from '@/lib/errorHandling';
import { decodeContractError } from '@/lib/errorDecoding';

type FormState = 'upload' | 'details' | 'confirm' | 'submitting' | 'success';

export function IssueCertificate() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { refetchInstitution } = useAuthStore();
  
  const [formState, setFormState] = useState<FormState>('upload');
  const [hashResult, setHashResult] = useState<HashResult | null>(null);
  const [studentWallet, setStudentWallet] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use the certificate issuance hook with callbacks
  const { 
    issueCertificate, 
    isPending, 
    isConfirming,
    error: txError,
    certificateId,
    reset 
  } = useCertificateIssuanceWithCallback(
    (hash, certId) => {
      logger.transaction('Certificate issued successfully', hash, {
        certificateId: certId?.toString(),
      });
      setFormState('success');
      // Refetch institution data to update totalCertificatesIssued counter
      if (refetchInstitution) {
        setTimeout(() => refetchInstitution(), 1000);
      }
    },
    (err) => {
      logger.error('Failed to issue certificate', err);
      const userFriendlyError = decodeContractError(err);
      setError(userFriendlyError);
      setFormState('confirm');
    }
  );

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

  const handleSubmit = async () => {
    if (!hashResult || !validateWallet(studentWallet)) return;

    // Rate limiting check
    if (!globalRateLimiter.isAllowed('certificate-issue')) {
      const remaining = globalRateLimiter.getRemainingAttempts('certificate-issue');
      setError(`Rate limit exceeded. Please wait before issuing another certificate. Remaining attempts: ${remaining}`);
      logger.warn('Certificate issuance rate limited', { studentWallet });
      return;
    }

    setFormState('submitting');
    setError(null);
    
    try {
      const sanitizedWallet = sanitizeAddress(studentWallet);
      if (!sanitizedWallet) {
        throw new Error('Invalid wallet address');
      }

      logger.userAction('Issuing certificate', {
        documentHash: hashResult.hash,
        studentWallet: sanitizedWallet,
      });

      issueCertificate({
        documentHash: hashResult.hash,
        studentWallet: sanitizedWallet,
        metadataURI: '',
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
            (stepNum === 2 && ['confirm', 'submitting', 'success'].includes(formState));

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

          {/* Actions */}
          <div className="flex gap-4">
            <button onClick={() => setFormState('upload')} className="btn-secondary flex-1">
              Back
            </button>
            <button
              onClick={() => validateWallet(studentWallet) && setFormState('confirm')}
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
            </div>
          </div>

          {(error || txError) && (
            <div className="card border-red-500/30 bg-red-500/10">
              <p className="text-red-400">{error || txError?.message}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setFormState('details')}
              className="btn-secondary flex-1"
              disabled={formState === 'submitting'}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || isConfirming}
              className="btn-primary flex-1"
            >
              {isPending || isConfirming ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isPending ? 'Confirming...' : 'Processing...'}
                </>
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


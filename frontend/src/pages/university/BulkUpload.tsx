// src/pages/university/BulkUpload.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { readContract } from '@wagmi/core';
import { useAuthStore } from '@/store/authStore';
import { useCanIssueCertificates } from '@/hooks';
import { useBatchCertificateIssuance } from '@/hooks/useBatchCertificateIssuance';
import {
  downloadCSVTemplate,
  parseCSV,
  matchPDFsToEntries,
  type BulkCertificateEntry,
} from '@/lib/csvTemplate';
import { generatePDFHash } from '@/lib/pdfHash';
import { CERTIFICATE_REGISTRY_ADDRESS, config } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { logger } from '@/lib/logger';

export function BulkUpload() {
  const { isConnected } = useAccount();
  const { institutionData, refetchInstitution } = useAuthStore();
  
  // Real-time institution status check
  const { canIssue, isLoading: isCheckingStatus, reason, refetch: refetchStatus } = useCanIssueCertificates();
  
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [entries, setEntries] = useState<BulkCertificateEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [failedCerts, setFailedCerts] = useState<number[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const { 
    issueCertificatesBatch, 
    isPending, 
    isConfirming, 
    isSuccess,
    error: batchError,
    certificateIds,
    reset: resetBatch
  } = useBatchCertificateIssuance();

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCSVFile(file);
    }
  };

  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPdfFiles(prev => [...prev, ...files]); // Append new files to existing ones
  };

  const handlePDFReplace = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPdfFiles(files); // Replace all files
  };

  const removePDFFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processCSVAndMatch = async () => {
    if (!csvFile) {
      alert('Please upload a CSV file');
      return;
    }

    try {
      const csvText = await csvFile.text();
      const parsed = parseCSV(csvText);
      
      if (parsed.length === 0) {
        alert('CSV file has no data rows');
        return;
      }

      if (parsed.length > 50) {
        alert('Maximum batch size is 50 certificates. Please split into smaller batches.');
        return;
      }

      const matched = matchPDFsToEntries(parsed, pdfFiles);
      
      // Compute hashes for all PDFs
      const entriesWithHashes = await Promise.all(
        matched.map(async (entry) => {
          if (entry.pdfFile) {
            const hashResult = await generatePDFHash(entry.pdfFile);
            return { ...entry, documentHash: hashResult.hash };
          }
          return entry;
        })
      );

      setEntries(entriesWithHashes);
      setCurrentStep('preview');
    } catch (error) {
      alert(`Error processing CSV: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const startBulkIssuance = async () => {
    logger.info('startBulkIssuance called');
    const validEntries = entries.filter(e => e.validationErrors.length === 0 && e.documentHash);
    
    if (validEntries.length === 0) {
      alert('No valid entries to process');
      return;
    }

    if (!CERTIFICATE_REGISTRY_ADDRESS) {
      alert('Certificate registry address not configured');
      return;
    }

    // CRITICAL: Real-time authorization check before bulk issuance
    if (!canIssue) {
      alert(reason || 'Your institution cannot issue certificates. Please contact an administrator.');
      logger.error('Bulk issuance blocked:', reason);
      return;
    }

    // Legacy check (kept for backward compatibility with cached data)
    if (!institutionData?.isVerified) {
      alert('Your institution must be verified before issuing certificates. Please contact an administrator.');
      return;
    }

    if (!institutionData?.isActive) {
      alert('Your institution account is not active. Please contact an administrator.');
      return;
    }

    logger.info(`Starting bulk issuance of ${validEntries.length} certificates`);
    logger.info(`Institution verified: ${institutionData.isVerified}, active: ${institutionData.isActive}`);

    setCurrentStep('processing');
    setFailedCerts([]);
    setErrorMessages([]);

    try {
      // Check for duplicate hashes before submitting
      const duplicateChecks = await Promise.all(
        validEntries.map(async (entry, index) => {
          try {
            const existingCertId = await readContract(config, {
              address: CERTIFICATE_REGISTRY_ADDRESS,
              abi: CertificateRegistryABI.abi,
              functionName: 'hashToCertificateId',
              args: [entry.documentHash as `0x${string}`],
            });

            if (existingCertId && existingCertId.toString() !== '0') {
              return {
                index,
                isDuplicate: true,
                message: `Certificate hash already exists (Certificate ID: ${existingCertId}). This PDF was already issued to a student.`
              };
            }
            return { index, isDuplicate: false };
          } catch (error) {
            logger.error(`Error checking duplicate for entry ${index}`, error);
            return {
              index,
              isDuplicate: true,
              message: `Error checking certificate: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
        })
      );

      // Filter out duplicates
      const duplicates = duplicateChecks.filter(check => check.isDuplicate);
      const validIndexes = duplicateChecks
        .filter(check => !check.isDuplicate)
        .map(check => check.index);

      // Log duplicates as failures
      if (duplicates.length > 0) {
        setFailedCerts(duplicates.map(d => d.index));
        setErrorMessages(duplicates.map(d => `Row ${d.index + 1}: ${d.message}`));
      }

      // If all entries are duplicates, stop here
      if (validIndexes.length === 0) {
        logger.warn('All entries are duplicates, no certificates to issue');
        return;
      }

      // Prepare batch data for valid entries only
      const batchData = validIndexes.map(index => {
        const entry = validEntries[index];
        return {
          documentHash: entry.documentHash as `0x${string}`,
          studentWallet: entry.studentWallet as `0x${string}`,
          metadataURI: ''
        };
      });

      logger.info(`Issuing ${batchData.length} certificates in a single transaction`);
      
      // Call the batch issuance function - this will trigger a SINGLE MetaMask confirmation
      await issueCertificatesBatch(batchData);
      
    } catch (error) {
      logger.error('Bulk issuance process error:', error);
      
      let errorMsg = 'Unknown error occurred during batch issuance';
      if (error instanceof Error) {
        const errStr = error.message.toLowerCase();
        
        if (errStr.includes('unauthorizedissuer') || errStr.includes('unauthorized')) {
          errorMsg = 'Your institution is not authorized to issue certificates. Please ensure your institution is verified and active.';
        } else if (errStr.includes('user rejected') || errStr.includes('user denied')) {
          errorMsg = 'Transaction was rejected by user.';
        } else {
          errorMsg = error.message;
        }
      }
      
      alert(`Error during bulk issuance: ${errorMsg}`);
      setCurrentStep('preview'); // Go back to preview on error
    }
  };

  // Handle success - refresh institution data
  useEffect(() => {
    if (isSuccess && certificateIds.length > 0) {
      logger.info(`Successfully issued ${certificateIds.length} certificates`, { certificateIds });
      if (refetchInstitution) {
        setTimeout(() => refetchInstitution(), 1000);
      }
    }
  }, [isSuccess, certificateIds, refetchInstitution]);

  // Handle batch error
  useEffect(() => {
    if (batchError && currentStep === 'processing') {
      logger.error('Batch issuance error:', batchError);
      setErrorMessages(prev => [...prev, `Batch transaction error: ${batchError}`]);
    }
  }, [batchError, currentStep]);

  const resetForm = () => {
    setCSVFile(null);
    setPdfFiles([]);
    setEntries([]);
    setCurrentStep('upload');
    setFailedCerts([]);
    setErrorMessages([]);
    resetBatch();
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h1>
        <p className="text-surface-400">
          Please connect your wallet to access bulk certificate upload.
        </p>
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

  // CRITICAL: Block bulk upload UI if institution cannot issue certificates
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
              <h2 className="text-xl font-bold text-white mb-2">Bulk Certificate Upload Unavailable</h2>
              <p className="text-red-400 mb-4">{reason}</p>
              <div className="flex gap-3">
                <Link to="/university/dashboard" className="btn-secondary">
                  Back to Dashboard
                </Link>
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

  // Legacy check (kept for backward compatibility) - but real-time check above takes precedence
  if (!institutionData?.isActive) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Institution Not Active</h1>
        <p className="text-surface-400 mb-6">
          Your institution must be verified and active to issue certificates.
        </p>
        <Link to="/university/dashboard" className="btn-primary">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Bulk Certificate Upload</h1>
        <p className="text-surface-400">
          Issue multiple certificates at once using CSV and PDF files
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${currentStep === 'upload' ? 'text-primary-400' : 'text-surface-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'upload' ? 'border-primary-400 bg-primary-400/20' : 'border-surface-600'}`}>
            1
          </div>
          <span className="font-medium">Upload Files</span>
        </div>
        <div className="w-12 h-0.5 bg-surface-700" />
        <div className={`flex items-center gap-2 ${currentStep === 'preview' ? 'text-primary-400' : 'text-surface-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'preview' ? 'border-primary-400 bg-primary-400/20' : 'border-surface-600'}`}>
            2
          </div>
          <span className="font-medium">Preview</span>
        </div>
        <div className="w-12 h-0.5 bg-surface-700" />
        <div className={`flex items-center gap-2 ${currentStep === 'processing' ? 'text-primary-400' : 'text-surface-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'processing' ? 'border-primary-400 bg-primary-400/20' : 'border-surface-600'}`}>
            3
          </div>
          <span className="font-medium">Process</span>
        </div>
      </div>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          {/* Template Download */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">1. Download CSV Template</h2>
            <p className="text-surface-400 mb-4">
              Download the template and fill in student information. Include columns for wallet address,
              name, program, graduation date, and PDF filename.
            </p>
            <button onClick={downloadCSVTemplate} className="btn-secondary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template
            </button>
          </div>

          {/* CSV Upload */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">2. Upload Completed CSV</h2>
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="input w-full mb-2"
            />
            {csvFile && (
              <div className="text-sm text-accent-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {csvFile.name} uploaded
              </div>
            )}
          </div>

          {/* PDF Upload */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">3. Upload Certificate PDFs</h2>
            <p className="text-surface-400 text-sm mb-4">
              Upload PDF files. Filenames must match those listed in the CSV. You can add more files at any time.
            </p>
            
            {pdfFiles.length === 0 ? (
              // Initial upload - no files yet
              <>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handlePDFReplace}
                  className="input w-full mb-2"
                  id="pdf-initial-upload"
                />
                <label htmlFor="pdf-initial-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-surface-600 hover:border-primary-500 rounded-lg p-8 text-center transition-colors">
                    <svg className="w-12 h-12 mx-auto text-surface-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-surface-300 font-medium mb-1">Click to upload PDF files</p>
                    <p className="text-surface-500 text-sm">or drag and drop</p>
                    <p className="text-surface-600 text-xs mt-2">PDF files only • Multiple files supported</p>
                  </div>
                </label>
              </>
            ) : (
              // Files uploaded - show list and "Choose More Files" button
              <div className="space-y-4">
                {/* Uploaded files list */}
                <div className="bg-surface-800/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-surface-700">
                    <span className="text-sm font-semibold text-surface-300">Uploaded Files ({pdfFiles.length})</span>
                    <button
                      onClick={() => setPdfFiles([])}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pdfFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between py-2 px-3 bg-surface-900/50 rounded group hover:bg-surface-900 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="text-sm text-surface-200 truncate" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-xs text-surface-500 flex-shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          onClick={() => removePDFFile(index)}
                          className="ml-3 text-surface-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove file"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add more files button */}
                <div className="flex gap-3">
                  <label htmlFor="pdf-add-more" className="flex-1">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handlePDFUpload}
                      className="hidden"
                      id="pdf-add-more"
                    />
                    <div className="btn-secondary w-full cursor-pointer flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Choose More Files
                    </div>
                  </label>
                  
                  <label htmlFor="pdf-replace-all" className="flex-1">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handlePDFReplace}
                      className="hidden"
                      id="pdf-replace-all"
                    />
                    <div className="btn-secondary w-full cursor-pointer flex items-center justify-center border-surface-600">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Replace All
                    </div>
                  </label>
                </div>

                {/* Summary */}
                <div className="flex items-center gap-2 text-sm text-accent-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {pdfFiles.length} PDF file(s) ready to process
                </div>
              </div>
            )}
          </div>

          {/* Process Button */}
          <div className="flex gap-4">
            <Link to="/university/dashboard" className="btn-secondary">
              Cancel
            </Link>
            <button
              onClick={processCSVAndMatch}
              disabled={!csvFile || pdfFiles.length === 0}
              className="btn-primary flex-1"
            >
              Continue to Preview
            </button>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {currentStep === 'preview' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Preview Certificates</h2>
            <p className="text-surface-400 mb-4">
              Review all entries before submitting. Fix any validation errors.
            </p>

            {/* Summary */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-800/50 rounded-lg p-4">
                <div className="text-sm text-surface-400">Total Entries</div>
                <div className="text-2xl font-bold text-white">{entries.length}</div>
              </div>
              <div className="bg-accent-500/10 rounded-lg p-4">
                <div className="text-sm text-surface-400">Valid</div>
                <div className="text-2xl font-bold text-accent-400">
                  {entries.filter(e => e.validationErrors.length === 0).length}
                </div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4">
                <div className="text-sm text-surface-400">Errors</div>
                <div className="text-2xl font-bold text-red-400">
                  {entries.filter(e => e.validationErrors.length > 0).length}
                </div>
              </div>
            </div>

            {/* Entry List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {entries.map((entry, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    entry.validationErrors.length > 0
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-surface-700 bg-surface-800/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-white">{entry.studentName}</div>
                      <div className="text-sm text-surface-400 font-mono">
                        {entry.studentWallet.slice(0, 10)}...{entry.studentWallet.slice(-8)}
                      </div>
                    </div>
                    {entry.validationErrors.length === 0 ? (
                      <span className="badge badge-success">Valid</span>
                    ) : (
                      <span className="badge badge-error">Error</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-surface-300 mb-2">
                    <div>Program: {entry.program}</div>
                    <div>Date: {entry.graduationDate}</div>
                    <div className="col-span-2">PDF: {entry.pdfFilename}</div>
                  </div>
                  {entry.validationErrors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {entry.validationErrors.map((error, i) => (
                        <div key={i} className="text-xs text-red-400 flex items-start gap-1">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button onClick={() => setCurrentStep('upload')} className="btn-secondary">
              Back
            </button>
            <button
              onClick={startBulkIssuance}
              disabled={entries.filter(e => e.validationErrors.length === 0).length === 0}
              className="btn-primary flex-1"
            >
              Start Processing ({entries.filter(e => e.validationErrors.length === 0).length} certificates)
            </button>
          </div>
        </div>
      )}

      {/* Processing Step */}
      {currentStep === 'processing' && (
        <div className="space-y-6">
          <div className="card text-center">
            <h2 className="text-xl font-semibold text-white mb-4">Processing Certificates</h2>
            
            {!isSuccess && !batchError ? (
              <>
                <svg className="w-16 h-16 mx-auto mb-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {isPending && (
                  <p className="text-surface-400 mb-6">
                    Waiting for wallet confirmation...
                  </p>
                )}
                {isConfirming && (
                  <p className="text-surface-400 mb-6">
                    Transaction submitted! Confirming on blockchain...
                    <br />
                    <span className="text-sm text-surface-500 mt-2 block">
                      Issuing {entries.filter(e => e.validationErrors.length === 0 && !failedCerts.includes(entries.indexOf(e))).length} certificates in a single transaction
                    </span>
                  </p>
                )}
              </>
            ) : isSuccess ? (
              <>
                <svg className="w-16 h-16 mx-auto mb-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-accent-400 font-semibold mb-6">
                  Batch Processing Complete!
                </p>
                <p className="text-surface-400 text-sm mb-4">
                  Successfully issued {certificateIds.length} certificates in a single transaction
                </p>
              </>
            ) : (
              <>
                <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <p className="text-red-400 font-semibold mb-6">Transaction Failed</p>
              </>
            )}

            {/* Progress Stats */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-surface-800/50 rounded-lg p-4">
                <div className="text-sm text-surface-400">Total</div>
                <div className="text-2xl font-bold text-white">
                  {entries.filter(e => e.validationErrors.length === 0).length}
                </div>
              </div>
              <div className="bg-accent-500/10 rounded-lg p-4">
                <div className="text-sm text-surface-400">
                  {isSuccess ? 'Completed' : 'To Issue'}
                </div>
                <div className="text-2xl font-bold text-accent-400">
                  {isSuccess ? certificateIds.length : entries.filter(e => e.validationErrors.length === 0 && !failedCerts.includes(entries.indexOf(e))).length}
                </div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4">
                <div className="text-sm text-surface-400">Failed</div>
                <div className="text-2xl font-bold text-red-400">{failedCerts.length}</div>
              </div>
            </div>

            {/* Progress Bar */}
            {!isSuccess && !batchError && (
              <div className="w-full bg-surface-700 rounded-full h-3 overflow-hidden mb-6">
                <div
                  className={`h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300 ${
                    isConfirming ? 'animate-pulse' : ''
                  }`}
                  style={{
                    width: isPending ? '50%' : isConfirming ? '75%' : '0%',
                  }}
                />
              </div>
            )}

            {/* Duplicate/Failed Messages */}
            {failedCerts.length > 0 && errorMessages.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-yellow-400 font-semibold mb-2">Skipped Entries (Pre-check):</h3>
                <div className="space-y-1 text-sm text-yellow-300 max-h-40 overflow-y-auto">
                  {errorMessages.map((msg, i) => (
                    <div key={i}>{msg}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Batch Error Message */}
            {batchError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-red-400 font-semibold mb-2">Transaction Error:</h3>
                <div className="text-sm text-red-300">{batchError}</div>
              </div>
            )}

            {/* Success: Show issued certificate IDs */}
            {isSuccess && certificateIds.length > 0 && (
              <div className="bg-accent-500/10 border border-accent-500/30 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-accent-400 font-semibold mb-2">Issued Certificate IDs:</h3>
                <div className="text-sm text-surface-300 max-h-40 overflow-y-auto space-y-1">
                  {certificateIds.map((certId, i) => (
                    <div key={i} className="font-mono">
                      Certificate #{certId.toString()}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(isSuccess || batchError) && (
              <div className="flex gap-4">
                <button onClick={resetForm} className="btn-secondary flex-1">
                  Upload More
                </button>
                {isSuccess && (
                  <Link to="/university/certificates" className="btn-primary flex-1">
                    View Certificate Registry
                  </Link>
                )}
                {batchError && (
                  <button onClick={() => setCurrentStep('preview')} className="btn-primary flex-1">
                    Back to Preview
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkUpload;

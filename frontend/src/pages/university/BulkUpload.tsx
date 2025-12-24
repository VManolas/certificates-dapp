// src/pages/university/BulkUpload.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract } from '@wagmi/core';
import { useAuthStore } from '@/store/authStore';
import {
  downloadCSVTemplate,
  parseCSV,
  matchPDFsToEntries,
  type BulkCertificateEntry,
} from '@/lib/csvTemplate';
import { generatePDFHash } from '@/lib/pdfHash';
import { CERTIFICATE_REGISTRY_ADDRESS, config } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';

export function BulkUpload() {
  const { isConnected } = useAccount();
  const { institutionData, refetchInstitution } = useAuthStore();
  
  const [csvFile, setCSVFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [entries, setEntries] = useState<BulkCertificateEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [processingIndex, setProcessingIndex] = useState(0);
  const [completedCerts, setCompletedCerts] = useState(0);
  const [failedCerts, setFailedCerts] = useState<number[]>([]);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const { writeContractAsync } = useWriteContract();

  if (!writeContractAsync) {
    console.error('writeContractAsync is not available');
  }

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCSVFile(file);
    }
  };

  const handlePDFUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPdfFiles(files);
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
    console.log('startBulkIssuance called');
    const validEntries = entries.filter(e => e.validationErrors.length === 0 && e.documentHash);
    
    if (validEntries.length === 0) {
      alert('No valid entries to process');
      return;
    }

    if (!CERTIFICATE_REGISTRY_ADDRESS) {
      alert('Certificate registry address not configured');
      return;
    }

    if (!writeContractAsync) {
      alert('Wallet connection error. Please reconnect your wallet.');
      console.error('writeContractAsync is undefined');
      return;
    }

    // Check institution status before proceeding
    if (!institutionData?.isVerified) {
      alert('Your institution must be verified before issuing certificates. Please contact an administrator.');
      return;
    }

    if (!institutionData?.isActive) {
      alert('Your institution account is not active. Please contact an administrator.');
      return;
    }

    console.log(`Starting bulk issuance of ${validEntries.length} certificates`);
    console.log(`Institution verified: ${institutionData.isVerified}, active: ${institutionData.isActive}`);

    setCurrentStep('processing');
    setCompletedCerts(0);
    setFailedCerts([]);
    setErrorMessages([]);

    try {
      for (let i = 0; i < validEntries.length; i++) {
        setProcessingIndex(i);
        const entry = validEntries[i];
        
        try {
          console.log(`Issuing certificate ${i + 1}/${validEntries.length} for ${entry.studentWallet}`);
          console.log(`Document hash: ${entry.documentHash}`);
          
          // Check if this hash already exists on-chain
          const existingCertId = await readContract(config, {
            address: CERTIFICATE_REGISTRY_ADDRESS,
            abi: CertificateRegistryABI.abi,
            functionName: 'hashToCertificateId',
            args: [entry.documentHash as `0x${string}`],
          });

          console.log('Existing certificate ID:', existingCertId);

          if (existingCertId && existingCertId.toString() !== '0') {
            const errorMsg = `Certificate hash already exists (Certificate ID: ${existingCertId}). This PDF was already issued to a student. Please use a unique PDF for each certificate.`;
            console.error('⚠️ DUPLICATE:', errorMsg);
            setFailedCerts(prev => [...prev, i]);
            setErrorMessages(prev => [...prev, `Row ${i + 1}: ${errorMsg}`]);
            continue; // Skip this certificate
          }
          
          // Call the contract and wait for the transaction
          const hash = await writeContractAsync({
            address: CERTIFICATE_REGISTRY_ADDRESS,
            abi: CertificateRegistryABI.abi,
            functionName: 'issueCertificate',
            args: [
              entry.documentHash as `0x${string}`,
              entry.studentWallet as `0x${string}`,
              '', // metadataURI
            ],
          });

          console.log(`Transaction submitted: ${hash}`);
          
          // Wait for confirmation (using a simple delay for demo purposes)
          // In production, you'd use useWaitForTransactionReceipt properly
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          setCompletedCerts(prev => prev + 1);
          console.log(`Certificate ${i + 1} issued successfully`);
        } catch (error) {
          console.error(`Failed to issue certificate for ${entry.studentWallet}:`, error);
          
          // Parse the error to provide user-friendly messages
          let errorMsg = 'Unknown error occurred';
          if (error instanceof Error) {
            const errStr = error.message.toLowerCase();
            
            if (errStr.includes('unauthorizedissuer') || errStr.includes('unauthorized')) {
              errorMsg = 'Your institution is not authorized to issue certificates. Please ensure your institution is verified and active.';
            } else if (errStr.includes('certificatealreadyexists') || errStr.includes('already exists')) {
              errorMsg = 'This certificate PDF hash already exists in the system. Please use a unique PDF for each certificate.';
            } else if (errStr.includes('invalidstudentaddress')) {
              errorMsg = 'Invalid student wallet address provided.';
            } else if (errStr.includes('invaliddocumenthash')) {
              errorMsg = 'Invalid document hash generated from PDF.';
            } else if (errStr.includes('user rejected') || errStr.includes('user denied')) {
              errorMsg = 'Transaction was rejected by user.';
            } else {
              // Use the original error message if we can't categorize it
              errorMsg = error.message;
            }
          }
          
          setFailedCerts(prev => [...prev, i]);
          setErrorMessages(prev => [...prev, `Row ${i + 1}: ${errorMsg}`]);
        }
      }

      // Refresh institution data after all certificates are issued
      if (refetchInstitution) {
        setTimeout(() => refetchInstitution(), 1000);
      }
    } catch (error) {
      console.error('Bulk issuance process error:', error);
      alert(`Error during bulk issuance: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const resetForm = () => {
    setCSVFile(null);
    setPdfFiles([]);
    setEntries([]);
    setCurrentStep('upload');
    setProcessingIndex(0);
    setCompletedCerts(0);
    setFailedCerts([]);
    setErrorMessages([]);
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
            <h2 className="text-xl font-semibold text-white mb-4">3. Upload ALL Certificate PDFs</h2>
            <p className="text-surface-400 text-sm mb-4">
              Upload all PDF files at once. Filenames must match those listed in the CSV.
            </p>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handlePDFUpload}
              className="input w-full mb-2"
            />
            {pdfFiles.length > 0 && (
              <div className="text-sm text-accent-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {pdfFiles.length} PDF file(s) uploaded
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
            
            {completedCerts + failedCerts.length < entries.filter(e => e.validationErrors.length === 0).length ? (
              <>
                <svg className="w-16 h-16 mx-auto mb-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-surface-400 mb-6">
                  Issuing certificate {processingIndex + 1} of {entries.filter(e => e.validationErrors.length === 0).length}...
                </p>
              </>
            ) : (
              <>
                <svg className="w-16 h-16 mx-auto mb-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-accent-400 font-semibold mb-6">Processing Complete!</p>
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
                <div className="text-sm text-surface-400">Completed</div>
                <div className="text-2xl font-bold text-accent-400">{completedCerts}</div>
              </div>
              <div className="bg-red-500/10 rounded-lg p-4">
                <div className="text-sm text-surface-400">Failed</div>
                <div className="text-2xl font-bold text-red-400">{failedCerts.length}</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-surface-700 rounded-full h-3 overflow-hidden mb-6">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-300"
                style={{
                  width: `${((completedCerts + failedCerts.length) / entries.filter(e => e.validationErrors.length === 0).length) * 100}%`,
                }}
              />
            </div>

            {/* Error Messages */}
            {failedCerts.length > 0 && errorMessages.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-left">
                <h3 className="text-red-400 font-semibold mb-2">Errors:</h3>
                <div className="space-y-1 text-sm text-red-300 max-h-40 overflow-y-auto">
                  {errorMessages.map((msg, i) => (
                    <div key={i}>{msg}</div>
                  ))}
                </div>
              </div>
            )}

            {completedCerts + failedCerts.length >= entries.filter(e => e.validationErrors.length === 0).length && (
              <div className="flex gap-4">
                <button onClick={resetForm} className="btn-secondary flex-1">
                  Upload More
                </button>
                <Link to="/university/certificates" className="btn-primary flex-1">
                  View Certificate Registry
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkUpload;

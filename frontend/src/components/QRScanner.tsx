// src/components/QRScanner.tsx
import { useState, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { decodeQRCodePayload } from '@/lib/qrCode';
import { useCertificateVerification } from '@/hooks/useCertificateVerification';
import type { QRCodePayload } from '@/types/certificate';
import { verifyVerificationToken } from '@/lib/verificationToken';

interface QRScannerProps {
  onClose: () => void;
}

export function QRScanner({ onClose }: QRScannerProps) {
  const [manualUrl, setManualUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [decodedPayload, setDecodedPayload] = useState<QRCodePayload | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload'); // Default to upload, not camera
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Blockchain verification for decoded payload
  const {
    isValid: blockchainIsValid,
    isRevoked: blockchainIsRevoked,
    isLoading: blockchainIsLoading,
    error: blockchainError,
  } = useCertificateVerification(
    decodedPayload?.documentHash as `0x${string}` | undefined,
    !!decodedPayload?.documentHash // Only verify if documentHash exists
  );

  const handleScan = (result: string) => {
    
    // Check if it's a V1 data payload format
    if (result.startsWith('V1:')) {
      try {
        const payload = decodeQRCodePayload(result);
        setDecodedPayload(payload);
        setError(null);
        return;
      } catch (err) {
        console.error('❌ Failed to decode V1 payload:', err);
        setError('Invalid certificate QR code. The data could not be decoded.');
        return;
      }
    }
    
    // Check if it's a verification URL
    try {
      const url = new URL(result);
      
      // Preferred format: hash-based verification link
      if (url.pathname.includes('/verify')) {
        const tokenParam = url.searchParams.get('v');
        if (tokenParam) {
          const decodedToken = decodeURIComponent(tokenParam);
          const tokenResult = verifyVerificationToken(decodedToken);
          if (!tokenResult.valid) {
            setError(tokenResult.reason || 'Invalid verification token');
            return;
          }
          navigate(`/verify?v=${encodeURIComponent(decodedToken)}`);
          onClose();
          return;
        }

        const hashParam = url.searchParams.get('hash');
        if (hashParam) {
          navigate(`/verify?hash=${hashParam}`);
          onClose();
          return;
        }

        // Legacy cert-id links are intentionally blocked to reduce enumeration risk.
        const certParam = url.searchParams.get('cert');
        if (certParam) {
          setError('Legacy certificate-ID links are no longer supported. Please request a new secure verification link.');
          return;
        }
      }

      setError('Invalid QR code. Please scan a certificate verification QR code.');
    } catch (err) {
      // Not a URL, not a V1 payload
      console.error('❌ Unrecognized QR code format:', err);
      setError('Invalid QR code format. Expected a certificate QR code or verification URL.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrl) {
      handleScan(manualUrl);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPEG, etc.)');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image file is too large. Maximum size is 5MB.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setUploadedImage(null);

    try {
      // Read the file as data URL for display
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageDataUrl = event.target?.result as string;
        setUploadedImage(imageDataUrl);

        // Create an image element to decode
        const img = new Image();
        img.onload = () => {
          // Create canvas to extract image data
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) {
            setError('Failed to process image');
            setIsProcessing(false);
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);

          // Get image data
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          
          
          // Try multiple decoding strategies for better success rate
          let code = null;
          
          // Strategy 1: No inversion
          code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          
          // Strategy 2: Try inverted if first attempt failed
          if (!code) {
            code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
          }
          
          // Strategy 3: Try with only invert if still failed
          if (!code) {
            code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'invertFirst',
            });
          }

          if (code) {
            handleScan(code.data);
          } else {
            console.error('❌ QR Scanner: No QR code found in image');
            setError('No QR code found in the image. Please ensure:\n• The QR code is clearly visible\n• The image is not blurry\n• The QR code takes up most of the image\n• Try uploading a higher resolution image');
          }
          
          setIsProcessing(false);
        };

        img.onerror = () => {
          setError('Failed to load the image');
          setIsProcessing(false);
        };

        img.src = imageDataUrl;
      };

      reader.onerror = () => {
        setError('Failed to read the file');
        setIsProcessing(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error processing QR code image:', err);
      setError('Failed to process the image');
      setIsProcessing(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-surface-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <h2 className="text-xl font-bold text-white">
              {decodedPayload ? 'Certificate Information' : 'Scan QR Code'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {decodedPayload ? (
            /* Certificate Information Display */
            <div className="space-y-6">
              {/* Status Badge */}
              <div className={`rounded-lg p-4 border ${
                blockchainIsLoading
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : blockchainError || !decodedPayload.documentHash
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : blockchainIsRevoked
                  ? 'bg-red-500/10 border-red-500/30'
                  : blockchainIsValid
                  ? 'bg-accent-500/10 border-accent-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    blockchainIsLoading
                      ? 'bg-blue-500/20'
                      : blockchainError || !decodedPayload.documentHash
                      ? 'bg-yellow-500/20'
                      : blockchainIsRevoked
                      ? 'bg-red-500/20'
                      : blockchainIsValid
                      ? 'bg-accent-500/20'
                      : 'bg-red-500/20'
                  }`}>
                    {blockchainIsLoading ? (
                      <svg className="w-6 h-6 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (blockchainError || !decodedPayload.documentHash) ? (
                      <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : blockchainIsRevoked ? (
                      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : blockchainIsValid ? (
                      <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${
                      blockchainIsLoading
                        ? 'text-blue-400'
                        : blockchainError || !decodedPayload.documentHash
                        ? 'text-yellow-400'
                        : blockchainIsRevoked
                        ? 'text-red-400'
                        : blockchainIsValid
                        ? 'text-accent-400'
                        : 'text-red-400'
                    }`}>
                      {blockchainIsLoading
                        ? 'Verifying on Blockchain...'
                        : !decodedPayload.documentHash
                        ? 'Cannot Verify (Old QR Code)'
                        : blockchainError
                        ? 'Verification Error'
                        : blockchainIsRevoked
                        ? 'Certificate Revoked'
                        : blockchainIsValid
                        ? 'Certificate Verified ✓'
                        : 'Certificate Not Found'}
                    </h3>
                    <p className="text-surface-400 text-sm">
                      {blockchainIsLoading
                        ? 'Checking blockchain for certificate validity...'
                        : !decodedPayload.documentHash
                        ? 'QR code missing verification data - regenerate for blockchain verification'
                        : blockchainError
                        ? `Error: ${blockchainError.message}`
                        : blockchainIsRevoked
                        ? 'This certificate has been revoked by the institution'
                        : blockchainIsValid
                        ? 'This certificate is valid and registered on the blockchain'
                        : 'This certificate was not found on the blockchain (may be invalid or from a different network)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Certificate Details */}
              <div className="card bg-surface-800/50">
                <h4 className="text-white font-semibold mb-4">Certificate Details</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-surface-400 text-sm">Program</span>
                    <span className="text-white text-sm text-right font-medium max-w-xs">{decodedPayload.program}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-surface-400 text-sm">University</span>
                    <span className="text-white text-sm text-right font-medium max-w-xs">{decodedPayload.university}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-400 text-sm">Graduation Year</span>
                    <span className="text-white text-sm font-medium">{decodedPayload.graduationYear}</span>
                  </div>
                </div>
              </div>

              {/* Student Information (Privacy Controlled) */}
              {(decodedPayload.studentWallet || decodedPayload.studentInitials) && (
                <div className="card bg-blue-500/10 border border-blue-500/30">
                  <div className="flex items-start gap-3 mb-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-blue-300 font-semibold mb-1">Student Information</h4>
                      <p className="text-blue-200 text-xs mb-3">
                        The following information was shared by the student
                      </p>
                      <div className="space-y-2">
                        {decodedPayload.studentInitials && (
                          <div className="flex justify-between">
                            <span className="text-blue-300 text-sm">Initials</span>
                            <span className="text-white text-sm font-medium">{decodedPayload.studentInitials}</span>
                          </div>
                        )}
                        {decodedPayload.studentWallet && (
                          <div className="flex justify-between">
                            <span className="text-blue-300 text-sm">Wallet</span>
                            <span className="text-white text-sm font-mono">
                              {decodedPayload.studentWallet.slice(0, 6)}...{decodedPayload.studentWallet.slice(-4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Privacy Notice */}
              <div className="rounded-lg bg-surface-800/50 border border-surface-700 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="text-surface-200 font-medium mb-1 text-sm">Privacy Protected</h4>
                    <p className="text-surface-400 text-xs">
                      This information was shared directly by the student with privacy controls. 
                      {!decodedPayload.studentWallet && !decodedPayload.studentInitials && (
                        ' The student chose not to share personal information.'
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="text-xs text-surface-500 space-y-1">
                <div className="flex justify-between">
                  <span>QR Code Version</span>
                  <span>{decodedPayload.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Generated</span>
                  <span>{new Date(decodedPayload.generatedAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setDecodedPayload(null);
                    setUploadedImage(null);
                    setError(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Scan Another
                </button>
                <button
                  onClick={onClose}
                  className="btn-primary flex-1"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* QR Scanner Interface */
            <>
              {/* Tab Navigation */}
              <div className="flex gap-2 mb-6 p-1 bg-surface-800 rounded-lg">
                <button
                  onClick={() => {
                    setActiveTab('upload');
                    handleUploadClick();
                    setError(null);
                  }}
                  className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                    activeTab === 'upload'
                      ? 'bg-primary-600 text-white'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  📤 Upload Image
                </button>
                <button
                  onClick={() => {
                    setActiveTab('camera');
                    setUploadedImage(null);
                    setError(null);
                  }}
                  className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                    activeTab === 'camera'
                      ? 'bg-primary-600 text-white'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  📷 Camera Scan
                </button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Camera Scanner or Uploaded Image */}
              {activeTab === 'camera' && !uploadedImage ? (
                <div className="mb-6">
                  <p className="text-surface-400 text-sm mb-4">
                    Point your camera at a certificate QR code to verify
                  </p>
                  <div className="relative aspect-video bg-surface-800 rounded-lg overflow-hidden">
                    <Scanner
                      onScan={(result) => {
                        if (result && result.length > 0) {
                          handleScan(result[0].rawValue);
                        }
                      }}
                      onError={(error) => {
                        console.error('Scanner error:', error);
                        setError('Camera access denied. Please use the "Upload Image" tab instead, or grant camera permissions in your browser.');
                      }}
                      constraints={{
                        facingMode: 'environment',
                      }}
                      formats={['qr_code']}
                      components={{
                        onOff: false,
                        torch: true,
                        zoom: false,
                        finder: true,
                      }}
                      styles={{
                        container: {
                          width: '100%',
                          height: '100%',
                        },
                        video: {
                          objectFit: 'cover',
                        },
                      }}
                    />
                  </div>
                </div>
              ) : activeTab === 'upload' && !uploadedImage ? (
                <div className="mb-6">
                  <div 
                    onClick={handleUploadClick}
                    className="relative aspect-video bg-surface-800 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer border-2 border-dashed border-surface-600 hover:border-primary-500 transition-colors"
                  >
                    <div className="text-center p-8">
                      <svg className="w-16 h-16 mx-auto mb-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-white font-medium mb-2">Click to upload QR code image</p>
                      <p className="text-surface-400 text-sm">Supports PNG, JPEG, WebP formats</p>
                    </div>
                  </div>
                </div>
              ) : uploadedImage ? (
                <div className="mb-6">
                  <p className="text-surface-400 text-sm mb-4">
                    {isProcessing ? 'Processing QR code...' : 'Uploaded QR code image'}
                  </p>
                  <div className="relative aspect-video bg-surface-800 rounded-lg overflow-hidden flex items-center justify-center">
                    {isProcessing ? (
                      <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-4 text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <p className="text-surface-400">Decoding QR code...</p>
                      </div>
                    ) : (
                      <img
                        src={uploadedImage}
                        alt="Uploaded QR code"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setUploadedImage(null);
                      setError(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="mt-3 w-full btn-secondary flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Different Image
                  </button>
                </div>
              ) : null}

              {/* Error Display */}
              {error && (
                <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-400 text-sm flex items-start gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </p>
                </div>
              )}

              {/* Manual URL Input */}
              <div>
                <p className="text-surface-300 text-sm mb-3">Or paste verification link manually:</p>
                <form onSubmit={handleManualSubmit} className="flex gap-3">
                  <input
                    type="text"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://... or V1:..."
                    className="input flex-1"
                  />
                  <button type="submit" className="btn-primary">
                    Verify
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

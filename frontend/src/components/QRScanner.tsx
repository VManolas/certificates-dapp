// src/components/QRScanner.tsx
import { useState, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';

interface QRScannerProps {
  onClose: () => void;
}

export function QRScanner({ onClose }: QRScannerProps) {
  const [manualUrl, setManualUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleScan = (result: string) => {
    try {
      // Check if it's a verification URL
      const url = new URL(result);
      
      // Extract certificate ID from URL
      if (url.pathname.includes('/verify')) {
        const certParam = url.searchParams.get('cert');
        if (certParam) {
          navigate(`/verify?cert=${certParam}`);
          onClose();
          return;
        }
      }

      setError('Invalid QR code. Please scan a certificate verification QR code.');
    } catch (err) {
      setError('Invalid QR code format. Expected a URL.');
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
          
          // Decode QR code
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code) {
            handleScan(code.data);
          } else {
            setError('No QR code found in the image. Please upload a clear QR code image.');
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
      <div className="bg-surface-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-surface-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Scan QR Code</h2>
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
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6 p-1 bg-surface-800 rounded-lg">
            <button
              onClick={() => {
                setUploadedImage(null);
                setError(null);
              }}
              className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                !uploadedImage
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              📷 Camera Scan
            </button>
            <button
              onClick={handleUploadClick}
              className={`flex-1 py-2 px-4 rounded-md transition-colors text-sm font-medium ${
                uploadedImage
                  ? 'bg-primary-600 text-white'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              📤 Upload Image
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
          {!uploadedImage ? (
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
                    setError('Camera access denied or not available');
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
          ) : (
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
          )}

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
                placeholder="https://..."
                className="input flex-1"
              />
              <button type="submit" className="btn-primary">
                Verify
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

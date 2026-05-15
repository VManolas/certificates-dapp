// src/components/ShareCertificateModal.tsx
import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PrivacyControlModal } from './PrivacyControlModal';
import { generateQRCodePayload, getQRCodeSize } from '@/lib/qrCode';
import type { Certificate, PrivacySettings, QRCodePayload } from '@/types/certificate';

interface ShareCertificateModalProps {
  certificate: Partial<Certificate>;
  universityName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareCertificateModal({ 
  certificate, 
  universityName,
  isOpen, 
  onClose 
}: ShareCertificateModalProps) {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    includeWallet: false,
    includeInitials: false,
  });
  const [qrCodeData, setQRCodeData] = useState<string>('');
  const [qrPayload, setQRPayload] = useState<QRCodePayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrCodeGenerated, setQRCodeGenerated] = useState(false); // Track if QR was generated
  const qrRef = useRef<HTMLDivElement>(null);

  // Show privacy modal when component opens
  useEffect(() => {
    if (isOpen && !qrCodeData) {
      setShowPrivacyModal(true);
    }
  }, [isOpen, qrCodeData]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setQRCodeData('');
      setQRPayload(null);
      setQRCodeGenerated(false); // Reset the flag
    }
  }, [isOpen]);

  const handlePrivacyConfirm = (settings: PrivacySettings) => {
    
    setPrivacySettings(settings);
    
    // Generate QR code payload with privacy settings
    try {
      const payload = generateQRCodePayload(certificate, universityName, settings);
      
      // Parse the payload for display
      const base64Part = payload.substring(3);
      const jsonString = atob(base64Part);
      const parsedPayload = JSON.parse(jsonString) as QRCodePayload;
      
      // Set both states together
      setQRCodeData(payload);
      setQRPayload(parsedPayload);
      setQRCodeGenerated(true); // Mark as successfully generated
      
    } catch (error) {
      console.error('❌ Failed to generate/parse QR payload:', error);
      console.error('Certificate:', certificate);
    }
    
    // Close privacy modal
    setShowPrivacyModal(false);
  };

  const handleChangePrivacy = () => {
    setShowPrivacyModal(true);
  };

  const handleCopyLink = async () => {
    if (!qrCodeData) return;
    
    try {
      await navigator.clipboard.writeText(qrCodeData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    
    // Get the actual QR code size
    const svgWidth = svg.getAttribute('width') || qrSize.toString();
    const size = parseInt(svgWidth);
    

    // Convert SVG to canvas with high resolution
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use high resolution for better QR code quality
    const scale = 4; // 4x resolution
    canvas.width = size * scale;
    canvas.height = size * scale;
    

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      // Fill white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw QR code at high resolution
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);


      // Download as PNG with high quality
      canvas.toBlob((blob) => {
        if (!blob) {
          console.error('❌ Failed to create blob');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate-qr-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
      }, 'image/png', 1.0); // Maximum quality
    };

    img.onerror = (error) => {
      console.error('❌ Failed to load image:', error);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (!isOpen) return null;

  // Calculate QR code size based on payload
  const qrSize = qrPayload ? getQRCodeSize(qrPayload) : 200;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-surface-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-surface-700 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-surface-700">
            <h2 className="text-xl font-bold text-white">Share Certificate</h2>
            <button
              onClick={onClose}
              className="text-surface-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {!qrCodeData ? (
              // Waiting for privacy settings
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-primary-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-surface-400">
                  Configure your privacy settings to generate a QR code
                </p>
              </div>
            ) : (
              <>
                {/* QR Code Display */}
                <div className="flex flex-col items-center">
                  <div 
                    ref={qrRef}
                    className="bg-white p-4 rounded-xl shadow-lg"
                  >
                    <QRCodeSVG
                      value={qrCodeData}
                      size={qrSize}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-surface-400 text-sm mt-3 text-center">
                    Scan this QR code to verify the certificate
                  </p>
                </div>

                {/* Certificate Info Summary */}
                <div className="rounded-lg bg-surface-800/50 p-4 border border-surface-700">
                  <h3 className="text-surface-200 font-semibold mb-2">Shared Information</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-surface-400">Program:</span>
                      <span className="text-white">{qrPayload?.program || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">University:</span>
                      <span className="text-white">{qrPayload?.university || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Year:</span>
                      <span className="text-white">{qrPayload?.graduationYear || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Status:</span>
                      <span className={qrPayload?.status === 'Verified' ? 'text-accent-400' : 'text-red-400'}>
                        {qrPayload?.status || 'Unknown'}
                      </span>
                    </div>
                    {privacySettings.includeWallet && qrPayload?.studentWallet && (
                      <div className="flex justify-between pt-2 border-t border-surface-700">
                        <span className="text-surface-400">Wallet:</span>
                        <span className="text-white font-mono text-xs">
                          {qrPayload.studentWallet.slice(0, 6)}...{qrPayload.studentWallet.slice(-4)}
                        </span>
                      </div>
                    )}
                    {privacySettings.includeInitials && qrPayload?.studentInitials && (
                      <div className="flex justify-between">
                        <span className="text-surface-400">Initials:</span>
                        <span className="text-white">{qrPayload.studentInitials}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Privacy Settings Display */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <div>
                        <h4 className="text-blue-300 font-semibold mb-1">Privacy Settings</h4>
                        <div className="text-blue-200 text-xs space-y-1">
                          <div>Wallet: {privacySettings.includeWallet ? '✓ Included' : '✗ Hidden'}</div>
                          <div>Initials: {privacySettings.includeInitials ? '✓ Included' : '✗ Hidden'}</div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleChangePrivacy}
                      className="text-blue-400 hover:text-blue-300 text-sm underline"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Shareable Data */}
                <div>
                  <label className="block text-sm font-medium text-surface-200 mb-2">
                    QR Code Data
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qrCodeData}
                      readOnly
                      className="input flex-1 font-mono text-xs"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`btn-secondary px-4 transition-colors ${
                        copied ? 'bg-accent-500 text-white' : ''
                      }`}
                    >
                      {copied ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {copied && (
                    <p className="text-accent-400 text-sm mt-2 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied to clipboard!
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleDownloadQR}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </button>
                  <button
                    onClick={onClose}
                    className="btn-primary flex-1"
                  >
                    Done
                  </button>
                </div>

                {/* Help Text */}
                <div className="rounded-lg bg-primary-500/10 p-4 border border-primary-500/30">
                  <p className="text-primary-300 text-sm">
                    💡 <strong>Tip:</strong> Share the QR code or data string with employers or anyone who needs to verify your certificate. The information included is based on your privacy settings.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Privacy Control Modal */}
      <PrivacyControlModal
        isOpen={showPrivacyModal}
        onClose={() => {
          setShowPrivacyModal(false);
          if (!qrCodeGenerated) {
            // If QR code wasn't generated and they cancel the privacy modal, close main modal too
            onClose();
          }
        }}
        onConfirm={handlePrivacyConfirm}
        defaultSettings={privacySettings}
      />
    </>
  );
}

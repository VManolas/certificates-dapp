// src/components/ShareCertificateModal.tsx
import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareCertificateModalProps {
  certificateId: bigint;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareCertificateModal({ certificateId, isOpen, onClose }: ShareCertificateModalProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Generate verification URL dynamically
  const verificationUrl = `${window.location.origin}/verify?cert=${certificateId.toString()}`;

  // Reset copied state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    // Convert SVG to canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Download as PNG
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `certificate-${certificateId.toString()}-qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 rounded-2xl shadow-2xl max-w-md w-full border border-surface-700">
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
          {/* QR Code Display */}
          <div className="flex flex-col items-center">
            <div 
              ref={qrRef}
              className="bg-white p-4 rounded-xl shadow-lg"
            >
              <QRCodeSVG
                value={verificationUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-surface-400 text-sm mt-3 text-center">
              Scan this QR code to verify the certificate
            </p>
          </div>

          {/* Certificate Info */}
          <div className="rounded-lg bg-surface-800/50 p-4 border border-surface-700">
            <p className="text-surface-400 text-sm mb-1">Certificate ID</p>
            <p className="text-white font-mono text-lg">#{certificateId.toString()}</p>
          </div>

          {/* Shareable Link */}
          <div>
            <label className="block text-sm font-medium text-surface-200 mb-2">
              Shareable Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={verificationUrl}
                readOnly
                className="input flex-1 font-mono text-sm"
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
                Link copied to clipboard!
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
              Download QR Code
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
              💡 <strong>Tip:</strong> Share the link or QR code with employers or anyone who needs to verify your certificate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

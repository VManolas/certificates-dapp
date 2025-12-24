// src/components/WalletQRDisplay.tsx
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface WalletQRDisplayProps {
  address: string;
}

export function WalletQRDisplay({ address }: WalletQRDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('wallet-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `wallet-${address.slice(0, 10)}.png`;
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <div className="card bg-gradient-to-br from-primary-500/10 to-accent-500/10 border-primary-500/30">
      <div className="flex items-start gap-6">
        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl">
          <QRCodeSVG
            id="wallet-qr-code"
            value={address}
            size={128}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-2">Your Wallet Address</h3>
          <div className="bg-surface-800/50 rounded-lg p-3 mb-4 font-mono text-sm text-surface-200 break-all">
            {address}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            <button
              onClick={handleDownloadQR}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download QR
            </button>
          </div>

          <p className="text-surface-400 text-sm mt-4">
            Share this QR code or address with employers to allow them to verify your certificates.
          </p>
        </div>
      </div>
    </div>
  );
}

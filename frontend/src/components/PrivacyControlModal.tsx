// src/components/PrivacyControlModal.tsx
import { useState } from 'react';
import type { PrivacySettings } from '@/types/certificate';

interface PrivacyControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (settings: PrivacySettings) => void;
  defaultSettings?: Partial<PrivacySettings>;
}

/**
 * Privacy Control Modal
 * 
 * Allows students to control what information is included in the QR code when sharing certificates.
 * 
 * Always included:
 * - Program
 * - University
 * - Graduation Year
 * - Certificate Status (Verified/Revoked)
 * 
 * Optional (controlled by privacy settings):
 * - Student Wallet Address
 * - Student Initials
 */
export function PrivacyControlModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  defaultSettings
}: PrivacyControlModalProps) {
  const [includeWallet, setIncludeWallet] = useState(
    defaultSettings?.includeWallet ?? false
  );
  const [includeInitials, setIncludeInitials] = useState(
    defaultSettings?.includeInitials ?? false
  );
  const [initials, setInitials] = useState(
    defaultSettings?.initials ?? ''
  );
  const [initialsError, setInitialsError] = useState<string | null>(null);

  const validateInitials = (value: string): boolean => {
    if (!includeInitials) return true; // Not required if not including
    
    if (!value.trim()) {
      setInitialsError('Please enter your initials');
      return false;
    }
    
    if (value.length > 10) {
      setInitialsError('Initials must be 10 characters or less');
      return false;
    }
    
    // Allow letters, periods, and spaces (e.g., "J.D." or "J. D." or "JD")
    if (!/^[A-Za-z.\s]+$/.test(value)) {
      setInitialsError('Initials can only contain letters, periods, and spaces');
      return false;
    }
    
    setInitialsError(null);
    return true;
  };

  const handleConfirm = () => {
    // Validate initials if they're being included
    if (includeInitials && !validateInitials(initials)) {
      return;
    }

    const settings: PrivacySettings = {
      includeWallet,
      includeInitials,
      initials: includeInitials ? initials.trim() : undefined,
    };

    onConfirm(settings);
    onClose();
  };

  const handleInitialsToggle = (checked: boolean) => {
    setIncludeInitials(checked);
    if (!checked) {
      setInitialsError(null);
    } else {
      validateInitials(initials);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-900 rounded-2xl shadow-2xl max-w-lg w-full border border-surface-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-700">
          <div>
            <h2 className="text-xl font-bold text-white">Privacy Settings</h2>
            <p className="text-surface-400 text-sm mt-1">
              Choose what information to include in your QR code
            </p>
          </div>
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
          {/* Always Included Section */}
          <div className="rounded-lg bg-accent-500/10 border border-accent-500/30 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-accent-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-accent-300 font-semibold mb-1">Always Included</h3>
                <p className="text-accent-200 text-sm mb-2">
                  This information will always be visible to verify your certificate:
                </p>
                <ul className="text-accent-300 text-sm space-y-1">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Program/Degree
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    University Name
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Graduation Year
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Certificate Status
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Optional Information Section */}
          <div>
            <h3 className="text-white font-semibold mb-3">Optional Information</h3>
            <div className="space-y-4">
              {/* Wallet Address Toggle */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-surface-700 hover:border-surface-600 transition-colors">
                <input
                  type="checkbox"
                  id="include-wallet"
                  checked={includeWallet}
                  onChange={(e) => setIncludeWallet(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <label htmlFor="include-wallet" className="text-white font-medium cursor-pointer">
                    Include Wallet Address
                  </label>
                  <p className="text-surface-400 text-sm mt-1">
                    Your blockchain wallet address will be visible to the verifier
                  </p>
                </div>
              </div>

              {/* Initials Toggle */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-surface-700 hover:border-surface-600 transition-colors">
                <input
                  type="checkbox"
                  id="include-initials"
                  checked={includeInitials}
                  onChange={(e) => handleInitialsToggle(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <label htmlFor="include-initials" className="text-white font-medium cursor-pointer">
                    Include Initials
                  </label>
                  <p className="text-surface-400 text-sm mt-1">
                    Add your initials for personal identification (e.g., "J.D.")
                  </p>
                  
                  {/* Initials Input - shown when toggle is on */}
                  {includeInitials && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={initials}
                        onChange={(e) => {
                          setInitials(e.target.value);
                          setInitialsError(null);
                        }}
                        onBlur={() => validateInitials(initials)}
                        placeholder="e.g., J.D. or J. Smith"
                        maxLength={10}
                        className={`input w-full ${initialsError ? 'border-red-500' : ''}`}
                      />
                      {initialsError && (
                        <p className="text-red-400 text-xs mt-1">{initialsError}</p>
                      )}
                      <p className="text-surface-500 text-xs mt-1">
                        Maximum 10 characters • Letters, periods, and spaces only
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h4 className="text-blue-300 font-semibold mb-1">Privacy Protection</h4>
                <p className="text-blue-200 text-sm">
                  You have full control over your information. You can generate different QR codes with different privacy settings for different purposes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="btn-primary flex-1"
          >
            Generate QR Code
          </button>
        </div>
      </div>
    </div>
  );
}

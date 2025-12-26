// frontend/src/components/AuthMethodSelector.tsx
/**
 * Authentication Method Selector Modal
 * ====================================
 * 
 * Presents users with a choice between ZK Auth (privacy-preserving)
 * and Standard Web3 Auth (simple & familiar).
 * 
 * Features:
 * - Clear comparison of both methods
 * - Visual indicators for benefits/tradeoffs
 * - "Remember my choice" option
 * - Smooth animations
 * - Mobile responsive
 * 
 * Usage:
 * ```tsx
 * <AuthMethodSelector
 *   isOpen={showAuthMethodSelector}
 *   onClose={() => setShowAuthMethodSelector(false)}
 *   onSelectMethod={(method) => handleAuthMethod(method)}
 * />
 * ```
 */

import { useState } from 'react';
import type { AuthMethod } from '@/store/authStore';

interface AuthMethodSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMethod: (method: AuthMethod, remember: boolean) => void;
  /** If true, the user must select a method (no close button) */
  required?: boolean;
}

export function AuthMethodSelector({
  isOpen,
  onClose,
  onSelectMethod,
  required = false,
}: AuthMethodSelectorProps) {
  const [rememberChoice, setRememberChoice] = useState(false);

  if (!isOpen) return null;

  const handleSelect = (method: AuthMethod) => {
    onSelectMethod(method, rememberChoice);
  };

  const handleBackdropClick = () => {
    // Only allow closing via backdrop if not required
    if (!required) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-2xl border border-surface-700 shadow-2xl w-full max-w-3xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="relative px-8 py-6 bg-gradient-to-r from-primary-900/30 to-accent-900/30 border-b border-surface-700">
          {/* Only show close button if not required */}
          {!required && (
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-surface-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          <div className="pr-12">
            <h2 className="text-2xl font-bold text-white mb-2">
              Choose Your Login Method
            </h2>
            <p className="text-surface-300 text-sm">
              Select how you want to authenticate with zkCredentials
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* ZK Auth Option */}
            <button
              onClick={() => handleSelect('zk')}
              className="group text-left p-6 rounded-xl bg-gradient-to-br from-primary-900/20 to-primary-800/10 border-2 border-primary-500/30 hover:border-primary-500/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary-500/20"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors">
                <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                🔐 Private Login
                <span className="px-2 py-0.5 text-xs bg-accent-500/20 text-accent-400 rounded-full border border-accent-500/30">
                  Recommended
                </span>
              </h3>
              
              <p className="text-sm text-surface-400 mb-4">
                Zero-Knowledge Proof Authentication
              </p>

              {/* Benefits */}
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-surface-300">
                    <strong className="text-white">Maximum Privacy:</strong> Your wallet address stays hidden
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-surface-300">
                    <strong className="text-white">Enhanced Security:</strong> Cryptographic proof of identity
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-surface-300">
                    <strong className="text-white">No On-Chain Exposure:</strong> Untraceable authentication
                  </span>
                </div>
              </div>

              {/* Tradeoff */}
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs text-yellow-300">
                  Requires one-time setup (~30 seconds)
                </span>
              </div>

              {/* CTA */}
              <div className="mt-4 pt-4 border-t border-primary-500/20">
                <span className="text-sm font-medium text-primary-400 group-hover:text-primary-300 flex items-center gap-2">
                  Select Private Login
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </button>

            {/* Web3 Auth Option */}
            <button
              onClick={() => handleSelect('web3')}
              className="group text-left p-6 rounded-xl bg-gradient-to-br from-blue-900/20 to-blue-800/10 border-2 border-blue-500/30 hover:border-blue-500/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-white mb-2">
                🔑 Standard Login
              </h3>
              
              <p className="text-sm text-surface-400 mb-4">
                Traditional Web3 Wallet Authentication
              </p>

              {/* Benefits */}
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-surface-300">
                    <strong className="text-white">Simple & Fast:</strong> No setup required
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-surface-300">
                    <strong className="text-white">Familiar Experience:</strong> Just like other Web3 apps
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-surface-300">
                    <strong className="text-white">Instant Access:</strong> Login in seconds
                  </span>
                </div>
              </div>

              {/* Tradeoff */}
              <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <svg className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="text-xs text-orange-300">
                  Wallet address visible on-chain
                </span>
              </div>

              {/* CTA */}
              <div className="mt-4 pt-4 border-t border-blue-500/20">
                <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300 flex items-center gap-2">
                  Select Standard Login
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </button>
          </div>

          {/* Remember Choice Checkbox */}
          <div className="mt-6 pt-6 border-t border-surface-700">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-surface-600 bg-surface-800 checked:bg-primary-500 checked:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-colors cursor-pointer"
              />
              <span className="text-sm text-surface-300 group-hover:text-white transition-colors">
                Remember my choice (you can change this later in settings)
              </span>
            </label>
          </div>

          {/* Info Footer */}
          <div className="mt-6 p-4 bg-surface-800/50 border border-surface-700 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-surface-300">
                  <strong className="text-white">Both methods are secure and trustless.</strong> Private Login offers enhanced privacy by keeping your wallet address hidden until you choose to reveal it. Standard Login is simpler but your wallet address is visible on-chain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


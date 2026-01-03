// frontend/src/components/DevModeBanner.tsx
/**
 * Development Mode Banner
 * ======================
 * 
 * A visual indicator that shows when the app is running in development mode
 * with simplified ZK proofs and format-only verification.
 * 
 * Features:
 * - Sticky banner at top of page
 * - Collapsible details section
 * - Clear security status indicators
 * - Mobile responsive
 * 
 * Variants:
 * - "banner" - Full-width sticky banner (default)
 * - "badge" - Compact badge for smaller spaces
 * - "card" - Detailed card with full information
 */

import { useState } from 'react';

interface DevModeBannerProps {
  variant?: 'banner' | 'badge' | 'card';
  showDetails?: boolean;
}

export function DevModeBanner({ variant = 'banner', showDetails = false }: DevModeBannerProps) {
  const [isExpanded, setIsExpanded] = useState(showDetails);

  // Badge variant - compact indicator
  if (variant === 'badge') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
        </span>
        <span className="text-xs font-medium text-yellow-300">Development Mode</span>
      </div>
    );
  }

  // Card variant - detailed information
  if (variant === 'card') {
    return (
      <div className="card bg-gradient-to-r from-yellow-900/30 to-orange-900/20 border-yellow-500/30">
        <div className="flex items-start gap-4">
          {/* Warning Icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          {/* Content */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
              </span>
              Development Mode Active
            </h3>
            
            <p className="text-sm text-surface-300 mb-3">
              This application is running with development-only ZK authentication. 
              The verifier validates proof format but does not perform cryptographic verification.
            </p>

            {/* Security Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 text-surface-400">Proofs:</span>
                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  Simplified
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 text-surface-400">Verifier:</span>
                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                  Format-Only
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-16 text-surface-400">Use Case:</span>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Testing & Demo
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-xs text-red-300">
                ⚠️ <strong>Not for production:</strong> Do not use with real user data or sensitive information.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner variant (default) - sticky top banner
  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-yellow-900/95 to-orange-900/95 border-b border-yellow-500/30 backdrop-blur-md shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Left side - Status indicator */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-white">Development Mode</span>
              <span className="hidden sm:inline text-xs text-yellow-200/80">
                • ZK Proofs: Simplified • Verifier: Format-Only
              </span>
            </div>
          </div>

          {/* Right side - Toggle details button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-yellow-200 hover:text-white transition-colors rounded-lg hover:bg-yellow-500/10"
            aria-label="Toggle development mode details"
          >
            <span className="hidden sm:inline">
              {isExpanded ? 'Hide Details' : 'Show Details'}
            </span>
            <svg 
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="pb-4 animate-fadeIn">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Left column - What's Protected */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    What's Protected
                  </h4>
                  <ul className="space-y-1 text-xs text-surface-300">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Commitment cryptography (Poseidon hash)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Credential encryption (wallet signature)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>On-chain registration & session management</span>
                    </li>
                  </ul>
                </div>

                {/* Right column - What's Not Protected */}
                <div>
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    What's Not Protected
                  </h4>
                  <ul className="space-y-1 text-xs text-surface-300">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">✗</span>
                      <span>ZK proof generation (using placeholder proofs)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">✗</span>
                      <span>Cryptographic verification (format check only)</span>
                    </li>
                  </ul>
                  
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded">
                    <p className="text-xs text-red-300">
                      <strong>⚠️ Use Case:</strong> Testing and demonstration only
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



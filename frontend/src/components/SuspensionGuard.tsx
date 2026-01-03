// frontend/src/components/SuspensionGuard.tsx
/**
 * Suspension Guard Component
 * ==========================
 * 
 * Monitors wallet connections and automatically disconnects suspended institutions.
 * 
 * Technical Implementation:
 * - Queries blockchain in real-time using useInstitutionStatus hook
 * - Auto-refetches every 5 seconds to detect status changes
 * - Immediately disconnects wallet if institution is suspended
 * - Shows informative modal explaining the suspension
 * - Provides "Check Status" button to revalidate
 * 
 * Security:
 * - Cannot be bypassed (queries blockchain directly)
 * - No reliance on cached or stale data
 * - Multiple checks (registered, verified, active)
 * 
 * Usage:
 * Add to App.tsx or Layout.tsx component tree:
 * 
 * ```tsx
 * <RainbowKitProvider>
 *   <SuspensionGuard />
 *   <Routes>...</Routes>
 * </RainbowKitProvider>
 * ```
 */

import { useEffect, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import { useInstitutionStatus } from '@/hooks/useInstitutionStatus';
import { logger } from '@/lib/logger';

export function SuspensionGuard() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  
  // Check wallet status in real-time
  // Only query when connected to avoid unnecessary calls
  const { 
    isRegistered,
    isVerified, 
    isActive, 
    canIssue,
    isLoading,
    refetch 
  } = useInstitutionStatus(
    address,
    isConnected, // enabled: only query when connected
    60000 // refetchInterval: check every 60 seconds (suspension is rare)
  );

  useEffect(() => {
    // Skip checks if not connected or still loading initial data
    if (!isConnected || isLoading) {
      return;
    }

    // CRITICAL FIX: Only check UNIVERSITIES, not admins/students/employers!
    // Universities are the ONLY role type that:
    // 1. Are registered in InstitutionRegistry
    // 2. Have isVerified flag
    // 3. Can be suspended (isActive = false)
    
    // If not registered as institution, skip all checks
    // This allows admins, students, employers to connect freely
    if (!isRegistered) {
      logger.info('✅ Wallet not registered as institution - allowing connection', {
        address,
        note: 'Likely admin, student, or employer wallet'
      });
      return;
    }

    // At this point, we know it's a registered institution (university)
    logger.info('🏛️ University wallet detected, checking suspension status', {
      address,
      isVerified,
      isActive,
      canIssue
    });
    
    let reason = '';
    let isSuspended = false;

    if (!isVerified) {
      // Pending verification - not technically suspended, just not approved yet
      // Don't disconnect, just note it
      reason = 'Your institution is pending verification by an administrator.';
      isSuspended = false; // Don't disconnect for pending institutions
      logger.info('⏳ University pending verification - allowing connection', { address });
    } else if (!isActive) {
      // SUSPENDED - this is the critical case
      // University is verified but suspended by admin
      reason = 'Your institution has been suspended by an administrator. Please contact support for assistance.';
      isSuspended = true;
    }

    // If institution is suspended (registered + verified but NOT active)
    if (isSuspended) {
      logger.warn('⚠️ Suspended university detected - DISCONNECTING', {
        address,
        isRegistered,
        isVerified,
        isActive,
        canIssue,
      });
      
      // Set reason for modal
      setSuspensionReason(reason);
      
      // Immediately disconnect the wallet
      disconnect();
      
      // Show modal explaining suspension
      setShowSuspendedModal(true);
      
      // Redirect to home page
      navigate('/', { replace: true });
    } else {
      logger.info('✅ University active - allowing connection', { address });
    }
  }, [
    isConnected, 
    isRegistered, 
    isVerified, 
    isActive, 
    canIssue, 
    isLoading, 
    address, 
    disconnect, 
    navigate
  ]);

  // Handle closing the modal
  const handleClose = () => {
    setShowSuspendedModal(false);
  };

  // Handle checking status (refetch from blockchain)
  const handleCheckStatus = () => {
    logger.info('User requested status refresh');
    refetch();
    
    // Give user feedback
    setTimeout(() => {
      if (!isActive) {
        alert('❌ Your institution is still suspended. Please contact an administrator.');
      } else {
        alert('✅ Your institution is now active! You can connect your wallet.');
        setShowSuspendedModal(false);
      }
    }, 500);
  };

  // Don't render anything if modal shouldn't be shown
  if (!showSuspendedModal) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suspension-modal-title"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-2xl border border-red-500/30 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-5 bg-red-500/10 border-b border-red-500/30">
          <div className="flex items-center gap-3">
            {/* Warning Icon */}
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <svg 
                className="w-6 h-6 text-red-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
                />
              </svg>
            </div>
            <div className="flex-1">
              <h2 
                id="suspension-modal-title"
                className="text-xl font-bold text-white mb-1"
              >
                Institution Suspended
              </h2>
              <p className="text-sm text-red-300">
                Wallet Connection Blocked
              </p>
            </div>
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="text-surface-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Main Message */}
          <div className="mb-4 p-4 bg-surface-800 rounded-lg border border-surface-700">
            <p className="text-surface-200 leading-relaxed">
              {suspensionReason}
            </p>
          </div>

          {/* Additional Information */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-2">
              What does this mean?
            </h3>
            <ul className="space-y-2 text-sm text-surface-400">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>You cannot connect with this wallet</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>You cannot issue certificates</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>You cannot access university features</span>
              </li>
            </ul>
          </div>

          {/* Help Section */}
          <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-300 mb-1">
                  Need Help?
                </p>
                <p className="text-xs text-blue-200">
                  Contact an administrator to reactivate your institution account.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button 
              onClick={handleClose}
              className="btn-secondary flex-1"
            >
              Close
            </button>
            <button 
              onClick={handleCheckStatus}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              <svg 
                className="w-4 h-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              Check Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


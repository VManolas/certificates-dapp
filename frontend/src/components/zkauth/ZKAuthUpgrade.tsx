// frontend/src/components/zkauth/ZKAuthUpgrade.tsx
/**
 * ZK Auth Upgrade Component
 * ==========================
 * 
 * Allows existing users to upgrade to privacy-preserving ZK authentication.
 * This component handles the migration flow seamlessly.
 * 
 * Features:
 * - One-click upgrade from traditional wallet auth to ZK auth
 * - Automatic role migration
 * - Clear explanation of benefits
 * - Status indicator (enabled/disabled)
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useZKAuth, type ZKAuthRole } from '@/hooks/useZKAuth';
import { logger } from '@/lib/logger';

interface ZKAuthUpgradeProps {
  /** Show as card or inline */
  variant?: 'card' | 'inline';
  /** Callback when upgrade is complete */
  onUpgradeComplete?: () => void;
}

export function ZKAuthUpgrade({ variant = 'card', onUpgradeComplete }: ZKAuthUpgradeProps) {
  const { address, isConnected } = useAccount();
  const { role, zkAuth } = useAuthStore();
  const { register, login, isLoading, error } = useZKAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<'idle' | 'registering' | 'authenticating' | 'complete'>('idle');

  const handleUpgrade = async () => {
    if (!role || !isConnected || !address) {
      logger.error('Cannot upgrade: missing role or wallet');
      return;
    }

    setIsUpgrading(true);
    setUpgradeStep('registering');

    try {
      // Only students and employers can use ZK auth (not admin or university)
      if (role === 'student' || role === 'employer') {
        logger.info('Starting ZK auth registration', { role });
        
        // Step 1: Register with ZK auth
        await register(role as ZKAuthRole);
        
        logger.info('ZK auth registration successful');
        
        // Step 2: Auto-login
        setUpgradeStep('authenticating');
        await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
        
        await login();
        
        logger.info('ZK auth login successful');
        
        setUpgradeStep('complete');
        
        // Notify parent component
        if (onUpgradeComplete) {
          onUpgradeComplete();
        }
        
        // Auto-close success message after 2 seconds
        setTimeout(() => {
          setIsUpgrading(false);
          setUpgradeStep('idle');
        }, 2000);
      } else {
        throw new Error('Admin role cannot use ZK authentication');
      }
    } catch (error: any) {
      logger.error('ZK auth upgrade failed', error);
      setIsUpgrading(false);
      setUpgradeStep('idle');
    }
  };

  // Don't show if no role, already upgraded, or admin/university (Web3-only roles)
  if (!role || zkAuth.isZKAuthEnabled || role === 'admin' || role === 'university') {
    return null;
  }

  const containerClass = variant === 'card' 
    ? 'card bg-gradient-to-br from-primary-900/30 to-accent-900/30 border-primary-500/30'
    : 'flex items-center gap-4';

  return (
    <div className={containerClass}>
      {upgradeStep === 'complete' ? (
        // Success state
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            ✅ ZK Auth Enabled!
          </h3>
          <p className="text-sm text-surface-400">
            Your privacy-preserving authentication is now active.
          </p>
        </div>
      ) : (
        <>
          {variant === 'card' ? (
            // Card variant - full featured
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-white">
                    Upgrade to ZK Authentication
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-accent-500/20 text-accent-300 rounded">
                    Optional
                  </span>
                </div>
                <p className="text-sm text-surface-400 mb-4">
                  Enable privacy-preserving authentication with zero-knowledge proofs. 
                  Your wallet address won't be revealed during authentication.
                </p>
                
                <div className="grid sm:grid-cols-3 gap-3 mb-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-surface-300">Enhanced Privacy</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-surface-300">Zero-Knowledge</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-surface-300">Secure Sessions</span>
                  </div>
                </div>

                {upgradeStep !== 'idle' && (
                  <div className="mb-4 p-3 bg-primary-500/10 border border-primary-500/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-400"></div>
                      <div className="text-sm text-primary-300">
                        {upgradeStep === 'registering' && 'Generating ZK credentials...'}
                        {upgradeStep === 'authenticating' && 'Authenticating with ZK proof...'}
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">
                      ❌ {error.message}
                    </p>
                  </div>
                )}

                <button
                  onClick={handleUpgrade}
                  disabled={isLoading || isUpgrading}
                  className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpgrading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Upgrading...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Enable ZK Auth
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Inline variant - compact
            <>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-sm text-surface-400">
                    ZK Auth: <span className="text-red-400">Disabled</span>
                  </span>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={isLoading || isUpgrading}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {isUpgrading ? 'Upgrading...' : 'Enable'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}


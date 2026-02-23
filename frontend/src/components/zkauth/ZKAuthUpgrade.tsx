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

import { useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useZKAuth, type ZKAuthRole, type ZKAuthProgressEvent } from '@/hooks/useZKAuth';
import { logger } from '@/lib/logger';

interface ZKAuthUpgradeProps {
  /** Show as card or inline */
  variant?: 'card' | 'inline';
  /** Callback when upgrade is complete */
  onUpgradeComplete?: () => void;
}

export function ZKAuthUpgrade({ variant = 'card', onUpgradeComplete }: ZKAuthUpgradeProps) {
  const { address, isConnected } = useAccount();
  const {
    role,
    authMethod,
    zkAuth,
    setZKAuthEnabled,
    setZKAuthenticated,
    setAuthMethod,
    setPreferredAuthMethod,
  } = useAuthStore();
  const { register, login, isLoading, error, hasCredentials } = useZKAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeStep, setUpgradeStep] = useState<'idle' | 'registering' | 'authenticating' | 'complete'>('idle');
  const [upgradeMode, setUpgradeMode] = useState<'full_setup' | 'login_only'>('full_setup');
  const upgradeModeRef = useRef<'full_setup' | 'login_only'>('full_setup');
  const [metamaskStep, setMetamaskStep] = useState<1 | 2 | 3 | 4 | null>(null);
  const [metamaskHint, setMetamaskHint] = useState<string | null>(null);
  const [finalTxPhase, setFinalTxPhase] = useState<'idle' | 'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed'>('idle');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const activeRunIdRef = useRef(0);

  const beginNewRun = () => {
    activeRunIdRef.current += 1;
    return activeRunIdRef.current;
  };

  const isCurrentRun = (runId: number) => activeRunIdRef.current === runId;

  const handleProgressEvent = (event: ZKAuthProgressEvent, runId: number) => {
    if (!isCurrentRun(runId)) return;
    const mode = upgradeModeRef.current;
    switch (event) {
      case 'register_signature_required':
        setMetamaskStep(1);
        setMetamaskHint(null);
        break;
      case 'register_transaction_required':
      case 'register_transaction_submitted':
        setMetamaskStep(2);
        setMetamaskHint(null);
        break;
      case 'register_transaction_confirmed':
        setMetamaskStep(3);
        setMetamaskHint('Commitment registration confirmed. Next: sign to unlock your private credentials.');
        break;
      case 'login_wallet_access_required':
        // Some wallets show an explicit account-access prompt before signature.
        setMetamaskStep(mode === 'login_only' ? 1 : 3);
        setMetamaskHint('If MetaMask asks for account access, approve it to continue.');
        break;
      case 'login_signature_required':
        setMetamaskStep(mode === 'login_only' ? 2 : 3);
        setMetamaskHint(null);
        break;
      case 'login_signature_complete':
        setMetamaskStep(mode === 'login_only' ? 3 : 4);
        setMetamaskHint('Signature complete. Final step: confirm session start transaction.');
        setFinalTxPhase('awaiting_wallet_confirmation');
        break;
      case 'login_transaction_required':
        setMetamaskStep(mode === 'login_only' ? 3 : 4);
        setMetamaskHint('Please approve the final transaction in MetaMask.');
        setFinalTxPhase('awaiting_wallet_confirmation');
        break;
      case 'login_transaction_submitted':
        setMetamaskStep(mode === 'login_only' ? 3 : 4);
        setMetamaskHint('Final transaction submitted. Waiting for blockchain confirmation.');
        setFinalTxPhase('pending_onchain');
        break;
      case 'login_transaction_confirmed':
        setMetamaskStep(mode === 'login_only' ? 3 : 4);
        setMetamaskHint('Final transaction confirmed.');
        setFinalTxPhase('confirmed');
        break;
      default:
        break;
    }
  };

  const handleUpgrade = async () => {
    if (!role || !isConnected || !address) {
      logger.error('Cannot upgrade: missing role or wallet');
      return;
    }

    const runId = beginNewRun();
    setIsUpgrading(true);
    const loginOnly = hasCredentials;
    upgradeModeRef.current = loginOnly ? 'login_only' : 'full_setup';
    setUpgradeMode(loginOnly ? 'login_only' : 'full_setup');
    setUpgradeStep(loginOnly ? 'authenticating' : 'registering');
    setMetamaskStep(1);
    setMetamaskHint(null);
    setFinalTxPhase('idle');

    try {
      // Only students and employers can use ZK auth (not admin or university)
      if (role === 'student' || role === 'employer') {
        if (loginOnly) {
          if (!isCurrentRun(runId)) return;
          logger.info('Starting ZK auth upgrade with existing credentials (skip registration)', { role });
          setMetamaskHint('Existing private credentials detected for this wallet. Skipping registration and starting private session.');
        } else {
          if (!isCurrentRun(runId)) return;
          logger.info('Starting ZK auth registration', { role });
          // Step 1: Register with ZK auth
          await register(role as ZKAuthRole, (event) => handleProgressEvent(event, runId));
          if (!isCurrentRun(runId)) return;
          logger.info('ZK auth registration successful');
          // Step 2: Auto-login
          setUpgradeStep('authenticating');
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
          if (!isCurrentRun(runId)) return;
        }

        await login((event) => handleProgressEvent(event, runId));
        if (!isCurrentRun(runId)) return;
        
        logger.info('ZK auth login successful');
        // Keep the contract status explicit: show confirmed before success state.
        setFinalTxPhase('confirmed');
        setMetamaskHint('Final transaction confirmed.');
        // Give users enough time to read final-step states before success UI appears.
        await new Promise(resolve => setTimeout(resolve, 1600));
        if (!isCurrentRun(runId)) return;

        // Defensive synchronization: keep auth store aligned with successful ZK upgrade.
        // This prevents the UI from reverting to public/web3 presentation.
        setZKAuthEnabled(true);
        setZKAuthenticated(true);
        setAuthMethod('zk');
        setPreferredAuthMethod('zk');
        
        setUpgradeStep('complete');
        setShowSuccessPopup(true);
        setMetamaskStep(null);
        setMetamaskHint(null);
        
        // Notify parent component
        if (onUpgradeComplete) {
          onUpgradeComplete();
        }
        
        // Auto-close success message after 2 seconds
        setTimeout(() => {
          if (!isCurrentRun(runId)) return;
          setIsUpgrading(false);
          setUpgradeStep('idle');
          upgradeModeRef.current = 'full_setup';
          setUpgradeMode('full_setup');
          setShowSuccessPopup(false);
          setMetamaskStep(null);
          setMetamaskHint(null);
          setFinalTxPhase('idle');
        }, 2000);
      } else {
        throw new Error('Admin role cannot use ZK authentication');
      }
    } catch (error: any) {
      if (!isCurrentRun(runId)) return;
      logger.error('ZK auth upgrade failed', error);
      setIsUpgrading(false);
      setUpgradeStep('idle');
      upgradeModeRef.current = 'full_setup';
      setUpgradeMode('full_setup');
      setShowSuccessPopup(false);
      setMetamaskStep(null);
      setMetamaskHint(null);
      setFinalTxPhase('idle');
    }
  };

  // Don't show if no role, already upgraded, or admin/university (Web3-only roles)
  if (
    !role ||
    zkAuth.isZKAuthEnabled ||
    zkAuth.isZKAuthenticated ||
    authMethod === 'zk' ||
    role === 'admin' ||
    role === 'university'
  ) {
    return null;
  }

  const containerClass = variant === 'card' 
    ? 'card bg-gradient-to-br from-primary-900/30 to-accent-900/30 border-primary-500/30'
    : 'flex items-center gap-4';

  return (
    <div className={containerClass}>
      {showSuccessPopup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-surface-700 bg-surface-900 p-6 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Login Successful</h3>
            <p className="text-sm text-surface-300">
              Private Login is now active for your account.
            </p>
          </div>
        </div>
      )}
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
            <div className="space-y-4">
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

                {upgradeStep !== 'idle' && (
                  <div className="mb-4 rounded-xl border border-surface-700 bg-surface-800/40 p-4">
                    <h4 className="text-sm font-semibold text-white mb-1">MetaMask Interaction Steps</h4>
                    <p className="text-xs text-surface-400 mb-3">
                      {upgradeMode === 'login_only'
                        ? 'Existing private credentials were found. Follow these prompts to start a private session without re-registering.'
                        : 'Follow these prompts to complete ZK setup. This flow includes up to four wallet interactions.'}
                    </p>
                    <div className="space-y-2 text-xs">
                      {(upgradeMode === 'login_only'
                        ? [
                            {
                              step: 1 as const,
                              title: 'Approve wallet account access',
                              description: 'If prompted, allow wallet access so the app can request a signature.',
                            },
                            {
                              step: 2 as const,
                              title: 'Sign to unlock credentials',
                              description: 'Approve signature so the app can decrypt local ZK credentials for login.',
                            },
                            {
                              step: 3 as const,
                              title: 'Start private session transaction',
                              description: 'Confirm transaction to activate your private ZK-authenticated session.',
                            },
                          ]
                        : [
                            {
                              step: 1 as const,
                              title: 'Sign message',
                              description: 'Approve signature to securely encrypt your ZK credentials locally.',
                            },
                            {
                              step: 2 as const,
                              title: 'Register commitment transaction',
                              description: 'Confirm transaction to store your ZK commitment on-chain.',
                            },
                            {
                              step: 3 as const,
                              title: 'Sign to unlock credentials',
                              description: 'Approve signature so the app can decrypt local ZK credentials for login.',
                            },
                            {
                              step: 4 as const,
                              title: 'Start private session transaction',
                              description: 'Confirm transaction to activate your private ZK-authenticated session.',
                            },
                          ]
                      ).map((item) => {
                        const isDone = metamaskStep !== null && metamaskStep > item.step;
                        const isCurrent = metamaskStep === item.step;
                        return (
                          <div
                            key={item.step}
                            className={`flex items-start gap-2 p-2 rounded ${
                              isCurrent
                                ? 'bg-primary-500/10 border border-primary-500/30'
                                : isDone
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-surface-800/50 border border-surface-700'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-semibold ${
                                isDone
                                  ? 'bg-green-500/20 text-green-300'
                                  : isCurrent
                                  ? 'bg-primary-500/20 text-primary-300'
                                  : 'bg-surface-700 text-surface-400'
                              }`}
                            >
                              {isDone ? '✓' : item.step}
                            </div>
                            <div className="flex-1">
                              <p className="text-surface-200 font-medium">{item.title}</p>
                              <p className="text-surface-400">{item.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {metamaskHint && (
                      <p className="mt-3 text-xs text-blue-300">{metamaskHint}</p>
                    )}
                    {finalTxPhase !== 'idle' && (
                      <div
                        className={`mt-3 rounded border p-2 text-xs ${
                          finalTxPhase === 'awaiting_wallet_confirmation'
                            ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                            : finalTxPhase === 'pending_onchain'
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                            : 'border-green-500/30 bg-green-500/10 text-green-300'
                        }`}
                      >
                        {finalTxPhase === 'awaiting_wallet_confirmation' && 'Final transaction: waiting for wallet approval'}
                        {finalTxPhase === 'pending_onchain' && 'Final transaction: pending on blockchain'}
                        {finalTxPhase === 'confirmed' && 'Final transaction: confirmed'}
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">
                      ❌ {error.message}
                    </p>
                  </div>
                )}
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleUpgrade}
                  disabled={isLoading || isUpgrading}
                  className="btn-primary w-full sm:w-[430px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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


// frontend/src/components/UnifiedLoginModal.tsx
/**
 * Unified Login Modal
 * ===================
 * 
 * A comprehensive login modal that supports:
 * - ZK Auth registration and login
 * - Web3 wallet connection
 * - Role selection
 * - Auth method preference
 * 
 * Features:
 * - Automatic method detection
 * - Seamless flow between registration and login
 * - Clear visual feedback
 * - Mobile responsive
 * 
 * Usage:
 * ```tsx
 * <UnifiedLoginModal
 *   isOpen={showLogin}
 *   onClose={() => setShowLogin(false)}
 *   onSuccess={() => navigate('/dashboard')}
 * />
 * ```
 */

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { AuthMethodSelector } from './AuthMethodSelector';
import type { UserRole } from '@/store/authStore';

interface UnifiedLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export function UnifiedLoginModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Welcome to zkCredentials',
  description = 'Choose how you want to authenticate',
}: UnifiedLoginModalProps) {
  const { isConnected } = useAccount();
  const unifiedAuth = useUnifiedAuth();
  
  const [step, setStep] = useState<'connect' | 'method' | 'role' | 'zkRegister' | 'zkLogin'>('connect');
  const [selectedRole, setSelectedRole] = useState<'student' | 'university' | 'employer' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-progress through steps
  useEffect(() => {
    if (!isOpen) return;

    // Step 1: Wallet connection
    if (!isConnected) {
      setStep('connect');
      return;
    }

    // Step 2: Auth method selection
    if (!unifiedAuth.authMethod && !unifiedAuth.showAuthMethodSelector) {
      setStep('method');
      return;
    }

    // Step 3a: ZK Auth - Check if registered
    if (unifiedAuth.authMethod === 'zk') {
      if (unifiedAuth.zkAuth.hasCredentials) {
        setStep('zkLogin');
      } else {
        setStep('zkRegister');
      }
      return;
    }

    // Step 3b: Web3 Auth - Role selection (if multiple roles)
    if (unifiedAuth.authMethod === 'web3') {
      if (unifiedAuth.web3Auth.availableRoles.length > 1) {
        setStep('role');
      } else if (unifiedAuth.isAuthenticated) {
        // Single role, already authenticated
        handleSuccess();
      }
      return;
    }
  }, [isOpen, isConnected, unifiedAuth.authMethod, unifiedAuth.showAuthMethodSelector, unifiedAuth.zkAuth.hasCredentials, unifiedAuth.isAuthenticated, unifiedAuth.web3Auth.availableRoles]);

  const handleSuccess = () => {
    console.log('Login successful!');
    onSuccess?.();
    onClose();
  };

  const handleZKRegister = async () => {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await unifiedAuth.zkAuth.register(selectedRole);
      setStep('zkLogin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleZKLogin = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      await unifiedAuth.zkAuth.login();
      handleSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-2xl border border-surface-700 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-primary-900/30 to-accent-900/30 border-b border-surface-700">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-surface-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="pr-10">
            <h2 className="text-xl font-bold text-white mb-1">{title}</h2>
            <p className="text-surface-300 text-sm">{description}</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Step: Connect Wallet */}
          {step === 'connect' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
              <p className="text-sm text-surface-400 mb-6">
                Connect your Web3 wallet to continue
              </p>
              <ConnectButton />
            </div>
          )}

          {/* Step: Auth Method Selection */}
          {step === 'method' && (
            <AuthMethodSelector
              isOpen={true}
              onClose={onClose}
              onSelectMethod={(method, remember) => {
                unifiedAuth.selectAuthMethod(method, remember);
              }}
            />
          )}

          {/* Step: ZK Register */}
          {step === 'zkRegister' && (
            <div className="py-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Register with ZK Auth</h3>
                <p className="text-sm text-surface-400">
                  Choose your role to create your private authentication credentials
                </p>
              </div>

              {/* Role Selection */}
              <div className="space-y-3 mb-6">
                {[
                  { value: 'student' as const, label: 'Student', icon: '📚', desc: 'Access your certificates' },
                  { value: 'university' as const, label: 'University', icon: '🎓', desc: 'Issue certificates' },
                  { value: 'employer' as const, label: 'Employer', icon: '💼', desc: 'Verify credentials' },
                ].map((role) => (
                  <button
                    key={role.value}
                    onClick={() => setSelectedRole(role.value)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedRole === role.value
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-surface-700 bg-surface-800/50 hover:border-surface-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{role.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-white">{role.label}</div>
                        <div className="text-sm text-surface-400">{role.desc}</div>
                      </div>
                      {selectedRole === role.value && (
                        <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={handleZKRegister}
                disabled={!selectedRole || isProcessing}
                className="btn-primary w-full"
              >
                {isProcessing ? 'Registering...' : 'Register'}
              </button>
            </div>
          )}

          {/* Step: ZK Login */}
          {step === 'zkLogin' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Login with ZK Proof</h3>
              <p className="text-sm text-surface-400 mb-6">
                Generate a zero-knowledge proof to authenticate privately
              </p>
              <button
                onClick={handleZKLogin}
                disabled={isProcessing}
                className="btn-primary w-full"
              >
                {isProcessing ? 'Generating Proof...' : 'Login with ZK Proof'}
              </button>
            </div>
          )}

          {/* Step: Role Selection (Web3) */}
          {step === 'role' && (
            <div className="py-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Select Your Role</h3>
                <p className="text-sm text-surface-400">
                  You have multiple roles. Choose one to continue.
                </p>
              </div>

              <div className="space-y-3">
                {unifiedAuth.web3Auth.availableRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      // Set role and close
                      // Role will be set by unified auth
                      handleSuccess();
                    }}
                    className="w-full p-4 rounded-lg border-2 border-surface-700 bg-surface-800/50 hover:border-primary-500 hover:bg-primary-500/10 transition-all text-left"
                  >
                    <div className="font-medium text-white capitalize">{role}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

